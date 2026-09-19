#include <metal_stdlib>
using namespace metal;

// Three domain-warped curtains composited over the base color. Cheap enough for full-screen at 120 Hz.
static float hash21(float2 p) {
    p = fract(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// A curtain around a wandering centre line. The lower edge is crisp and the upper side trails off in a long soft tail,
// the way a real aurora is lit from below. Brightness varies along x, and fine vertical rays drift through the tail.
static float ribbon(float y, float centre, float width, float x, float t, float seed) {
    float d = y - centre;
    float w = d < 0.0 ? width * 0.42 : width;
    float core = exp(-(d * w) * (d * w));
    float curtain = 0.55 + 0.45 * sin(x * 4.0 + seed + t * 0.8) * sin(x * 1.7 - seed * 0.5 + t * 0.3);
    float rays = 0.8 + 0.2 * sin(x * 38.0 + seed * 3.0 + sin(x * 7.0 + t * 0.6 + seed) * 2.4);
    float tail = 1.0 - smoothstep(-0.14, 0.0, d);
    return core * curtain * mix(1.0, rays, tail);
}

[[ stitchable ]] half4 aurora(float2 position, half4 color, float2 size, float time, half4 c1, half4 c2, half4 c3, float intensity) {
    float2 uv = position / size;
    float t = time * 0.22;
    float y = uv.y - 0.5;

    float band1 = sin(uv.x * 3.0 + t * 1.3 + sin(uv.x * 1.5 + t) * 0.8);
    float band2 = sin(uv.x * 5.0 - t * 0.9 + cos(uv.x * 2.2 - t * 0.5) * 0.6);
    float band3 = sin(uv.x * 2.0 + t * 0.6 + sin(uv.x * 0.8 - t * 0.4) * 0.5);

    // Sit in the upper half so headlines and cards below stay on a calm ground; a slow breath keeps them from looking pinned.
    float breath = sin(t * 0.5) * 0.03;
    float a1 = ribbon(y, 0.06 + breath + band1 * 0.09, 8.0, uv.x, t, 0.0);
    float a2 = ribbon(y, -0.12 - breath + band2 * 0.07, 10.0, uv.x, t, 2.1);
    float a3 = ribbon(y, -0.28 + band3 * 0.10, 7.5, uv.x, t, 4.2);

    a1 = clamp(a1 * intensity * 0.85, 0.0, 1.0);
    a2 = clamp(a2 * intensity * 0.85, 0.0, 1.0);
    a3 = clamp(a3 * intensity * 0.85, 0.0, 1.0);

    // Coverage is the union of the three curtains; the colour is their coverage-weighted mix, so overlaps blend instead of blowing out.
    float coverage = 1.0 - (1.0 - a1) * (1.0 - a2) * (1.0 - a3);
    float3 rgb = (float3(c1.rgb) * a1 + float3(c2.rgb) * a2 + float3(c3.rgb) * a3) / max(a1 + a2 + a3, 1e-4);

    // Ordered-noise dither hides banding in the long gradients; +-1/255 is invisible as texture.
    rgb += (hash21(position + fract(time) * 7.0) - 0.5) * (2.0 / 255.0);

    return half4(half3(rgb * coverage), half(coverage)) * color.a;
}
