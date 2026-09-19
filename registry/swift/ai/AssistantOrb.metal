#include <metal_stdlib>
using namespace metal;

// Siri Wave orb, thinking phase. Four thin sine membranes travel left to right through the
// equator of a dark glass ball, seen through a refracting shell. The values are the Siri Wave
// rest look with the thinking remap applied (speed x 1.38, amplitude x 0.95) and are fixed:
// the sphere never moves, only the wave inside it. Colours are uniforms so a screen can tint
// the orb for what it portrays (a mood, a breath); motion never changes.
// Helpers are file-local (static) so several orb kernels can share one Xcode target.

namespace assistantOrbSiri {

constant int   kBands      = 4;
constant float kSpeed      = 1.311;
constant float kSeparation = 2.05;
constant float kSpread     = 0.0;
constant float kDetune     = 0.05;
constant float kAmplitude  = 0.266;
constant float kFrequency  = 1.45;
constant float kWidth      = 0.115;
constant float kTaper      = 1.75;
constant float kGround     = 0.08;
constant float kModelling  = 0.1;
constant float kRefraction = 0.5;
constant float kDispersion = 0.72;
constant float kSheen      = 0.36;
constant float kExposure   = 2.15;
constant float kRadius     = 0.45;

// The eight colours: four bands left to right in the stack, the ground wash, the crest and
// specular, and the cool and warm halves of the rim dispersion.
struct OrbColors { float3 band0, band1, band2, band3, ground, crest, rimCool, rimWarm; };

static float sat(float x) { return clamp(x, 0.0, 1.0); }
static float3 sat3(float3 c) { return clamp(c, float3(0.0), float3(1.0)); }

// Push a colour away from its luma; 0 is identity.
static float3 saturateColor(float3 c, float amount) {
  float l = dot(c, float3(0.2126, 0.7152, 0.0722));
  return sat3(mix(float3(l), c, 1.0 + amount));
}

// How far the shell pulls a sample inward, given its depth below the rim.
static float glassProfile(float depth, float rimWidth) {
  float d = sat(depth / max(rimWidth, 0.001));
  return pow(1.0 - sqrt(max(1.0 - (1.0 - d) * (1.0 - d), 0.0)), 0.68);
}

// One specular lobe on the glass.
static float lobe(float2 n, float2 dir, float cut, float power) {
  return pow(sat((dot(n, dir) - cut) / max(1.0 - cut, 0.001)), power);
}

// Directional light and shadow across the body.
static float3 modelBody(float3 c, float2 p, float3 crest) {
  c = mix(c, crest, kModelling * 0.22 * smoothstep(0.15, 1.15, dot(p, float2(-0.32, 0.78))));
  c *= 1.0 - kModelling * 0.34 * smoothstep(-0.1, 1.2, dot(p, float2(0.45, -0.62)));
  c *= 1.0 - kModelling * 0.22 * smoothstep(0.72, 1.08, length(p));
  return sat3(c);
}

// The interior, in ball space.
static float3 interior(float2 p, float t, OrbColors k) {
  // One envelope for every band: exactly zero at the rim.
  float env = pow(sat(1.0 - p.x * p.x), kTaper);
  float drift = t * 2.4;
  float mid = (float(kBands) - 1.0) * 0.5;

  float total = 0.0;
  float dominant = 0.0;
  float3 spectral = float3(0.0);
  for (int i = 0; i < kBands; i++) {
    float centred = float(i) - mid;
    float amp = kAmplitude * (1.0 - abs(centred) * kDetune * 1.1)
                * (0.82 + 0.18 * sin(t * 0.48 + centred * 1.1));
    float wave = sin(p.x * kFrequency * (1.0 + centred * kDetune) + drift + centred * kSeparation);
    float bw = kWidth * (1.0 + abs(centred) * 0.55);
    float d = p.y - (env * amp * wave + centred * kSpread);
    float w = exp(-d * d / max(bw * bw, 0.0001)) * env;

    float3 tint = k.band0;
    if (i == 1) tint = k.band1;
    else if (i == 2) tint = k.band2;
    else if (i == 3) tint = k.band3;
    // Squared weights: an overlap keeps the nearer band's colour instead of averaging to grey.
    spectral += tint * w * w;
    dominant += w * w;
    total += w;
  }
  spectral /= max(dominant, 0.0001);

  // Thin white crest on the main sine.
  float dMain = p.y - env * kAmplitude * sin(p.x * kFrequency + drift);
  float crest = exp(-dMain * dMain / 0.0028) * env;

  float3 col = mix(float3(0.0), k.ground, smoothstep(-0.82, 0.82, p.y)) * kGround;
  col += spectral * (1.0 - exp(-total * 0.7)) * env * 1.14;
  col += k.crest * crest * 0.18;
  col /= 1.0 + col * 0.19;
  return modelBody(col, p, k.crest);
}

} // namespace assistantOrbSiri

// position: SwiftUI passes this; y grows downward and is flipped below.
// bounds:   pass `.boundingRect`.
// time:     seconds since the view appeared. Keep it small; Float loses precision past ~1e5.
// colours:  linear-ish sRGB 0..1 via .float3. The Siri defaults are #2b5cff #ff4fa3 #ff6a2b
//           #e3170a, ground #12082e, crest #ffffff, rim #4d8aff / #ff4a1a.
[[ stitchable ]]
half4 assistantOrbSiriWave(float2 position, half4 currentColor, float4 bounds, float time,
                float3 band0, float3 band1, float3 band2, float3 band3,
                float3 ground, float3 crest, float3 rimCool, float3 rimWarm) {
  using namespace assistantOrbSiri;
  OrbColors k = { band0, band1, band2, band3, ground, crest, rimCool, rimWarm };
  float2 res = bounds.zw;
  float2 fc = position - bounds.xy;
  fc.y = res.y - fc.y;

  float m = min(res.x, res.y);
  float2 uv = (fc - 0.5 * res) / m;
  float px = 1.0 / m;
  float t = time * kSpeed;

  float2 p = uv / kRadius;
  float pd = length(p);
  float2 nrm = pd > 0.0001 ? p / pd : float2(0.0, 1.0);
  float ball = 1.0 - smoothstep(1.0 - px / kRadius, 1.0 + px / kRadius, pd);

  float edgeDepth = max(1.0 - pd, 0.0);
  float profile = glassProfile(edgeDepth, 0.05 + 0.42 * kDispersion);
  float2 rp = p - nrm * (1.15 * kRefraction * profile);

  float3 col = interior(rp, t, k);

  // Chromatic split at the rim: red from inside, green centred, blue from outside.
  float split = 0.14 * kDispersion * kRefraction * profile;
  if (split > 0.0008) {
    float3 lo = interior(rp - nrm * split, t, k);
    float3 up = interior(rp + nrm * split, t, k);
    col = float3(lo.r, col.g, up.b);
  }

  float rim = pow(1.0 - smoothstep(0.0, 0.026 + 0.075 * kDispersion, edgeDepth), 1.8) * ball;
  col = mix(col, k.crest, rim * kRefraction * 0.28);

  float disp = rim * kDispersion * 1.12;
  col = mix(col, k.rimCool, disp * lobe(nrm, normalize(float2(0.84, 0.54)), -0.32, 1.8));
  col = mix(col, k.rimWarm, disp * lobe(nrm, normalize(float2(-0.62, -0.78)), -0.28, 2.0));
  col *= 1.0 - rim * 0.12 * max(dot(nrm, float2(0.45, -0.89)), 0.0);

  col = mix(col, k.crest, sat(rim * lobe(nrm, normalize(float2(-0.68, 0.73)), 0.2, 2.8) * kSheen * 1.4));
  col = mix(col, k.rimCool, sat(rim * lobe(nrm, normalize(float2(0.74, -0.67)), 0.4, 3.6) * kSheen));

  // Circle mask with a 1px soft edge.
  float mask = 1.0 - smoothstep(kRadius - px, kRadius + px, length(uv));
  col = saturateColor(sat3(col * kExposure), 0.32);
  return half4(half3(col * mask), half(mask));
}
