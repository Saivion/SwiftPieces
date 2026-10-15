#include <metal_stdlib>
using namespace metal;

// Polynomial smooth minimum: joins two distances through a neck `k` wide.
static float mercuryToggleBlend(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

// The bead: a leading drop and a trailing drop melted together, so a fast move stretches it into a slug that pulls
// itself back round. The trailing drop shrinks as it falls behind, which keeps the bead's volume about the same.
// `wobble` rings the surface for a moment after a landing.
static float mercuryToggleField(float2 p, float2 lead, float2 trail, float r, float t, float wobble) {
    float gap = length(lead - trail);
    float stretch = clamp(gap / (r * 2.0), 0.0, 1.0);
    float a = length(p - lead) - r * (1.0 - 0.1 * stretch);
    float b = length(p - trail) - r * (0.92 - 0.3 * stretch);
    float d = mercuryToggleBlend(a, b, r * 1.1);
    float2 k = p - lead;
    float ang = atan2(k.y, k.x);
    return d + wobble * r * 0.07 * sin(ang * 3.0 + t * 22.0) * sin(t * 9.0);
}

// A studio for the mercury to reflect, by reflection direction (y up, z toward the viewer).
static float3 mercuryToggleStudio(float3 r) {
    float y = r.y + 0.1 * r.x - 0.12;
    float sky = mix(0.72, 1.0, smoothstep(0.0, 0.8, y));
    float floorLight = mix(0.3, 0.5, smoothstep(0.0, -0.9, y));
    float v = mix(floorLight, sky, smoothstep(-0.1, 0.1, y));
    v += 0.25 * exp(-pow((y - 0.08) / 0.06, 2.0));
    v *= 1.0 - 0.28 * exp(-pow((y + 0.1) / 0.1, 2.0));
    float2 box = r.xy - float2(-0.45, 0.55);
    v += 0.9 * exp(-dot(box, box) / 0.02);
    return v * mix(float3(1.0, 0.98, 0.95), float3(0.93, 0.96, 1.02), smoothstep(-0.2, 0.4, y));
}

// A bead of mercury lying in the track: domed like a drop on glass, reflecting the studio, with a soft contact shadow
// under it. Everything else in the view is clear, so the track shows through.
//
// lead, trail   the two drops' centres, in the view's coordinates
// radius        the bead's resting radius
// tint          multiplies the reflections
[[ stitchable ]] half4 mercuryToggle(float2 position, half4 color, float2 lead, float2 trail, float radius, float time, float wobble, half4 tint) {
    float2 p = float2(position.x, -position.y);
    float2 l = float2(lead.x, -lead.y);
    float2 tr = float2(trail.x, -trail.y);

    float d = mercuryToggleField(p, l, tr, radius, time, wobble);

    // A contact shadow, a little below the bead.
    float sd = mercuryToggleField(p + float2(0.0, radius * 0.18), l, tr, radius, time, wobble);
    float shadow = 0.32 * exp(-max(sd, 0.0) / (radius * 0.22)) * smoothstep(-1.0, 1.0, d);

    if (d > 0.75) {
        return half4(0.0h, 0.0h, 0.0h, half(shadow)) * color.a;
    }

    const float e = 0.5;
    float2 g = float2(
        mercuryToggleField(p + float2(e, 0.0), l, tr, radius, time, wobble) - mercuryToggleField(p - float2(e, 0.0), l, tr, radius, time, wobble),
        mercuryToggleField(p + float2(0.0, e), l, tr, radius, time, wobble) - mercuryToggleField(p - float2(0.0, e), l, tr, radius, time, wobble)
    );
    float gl = length(g);
    g = gl > 0.0001 ? g / gl : float2(0.0, 1.0);

    // A drop's profile: steep at the rim, flattening over the middle.
    float k = 1.0 - clamp(-d / (radius * 0.95), 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    float3 n = normalize(float3(g * k, sqrt(max(1.0 - k * k, 0.0)) + 0.0001));
    float3 refl = float3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
    float3 metal = mercuryToggleStudio(refl) * float3(tint.rgb);
    // Mercury is darker at its rim than chrome: a heavy liquid curling under.
    metal *= mix(1.0, 0.45, pow(k, 3.0));
    metal = clamp(metal, 0.0, 1.0);

    float cover = clamp(-d / 0.6 + 0.5, 0.0, 1.0);
    float3 rgb = metal * cover;
    float a = cover + shadow * (1.0 - cover);
    return half4(half3(rgb), half(a)) * color.a;
}
