#include <metal_stdlib>
using namespace metal;

static float hash21(float2 p) {
    float3 p3 = fract(float3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Smoothly interpolated value noise. Sampling continuously (no floor on the pixel) is what keeps the grain
// from aliasing against the pixel grid at 2x and 3x; the cell size is fractional in device pixels.
static float valueNoise(float2 p, float seed) {
    float2 i = floor(p);
    float2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float2 s = float2(seed * 13.0, seed * 7.0);
    float a = hash21(i + s);
    float b = hash21(i + s + float2(1.0, 0.0));
    float c = hash21(i + s + float2(0.0, 1.0));
    float d = hash21(i + s + float2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// W3C soft-light: darkens where the noise is below 0.5, lightens above, and leaves pure black and white untouched.
static float3 softLight(float3 b, float3 s) {
    float3 low = b - (1.0 - 2.0 * s) * b * (1.0 - b);
    float3 d = select(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, b <= 0.25);
    float3 high = b + (2.0 * s - 1.0) * (d - b);
    return select(high, low, s <= 0.5);
}

// Film grain: two octaves of value noise, weighted by luminance so it peaks in the midtones,
// composited with soft-light (useSoftLight = 1) or added linearly (0).
[[ stitchable ]] half4 grain(float2 position, half4 color, float frame, float amount, float scale, float useSoftLight) {
    if (color.a <= 0.0h) { return color; }
    float3 base = float3(color.rgb) / float(color.a);

    float fine = valueNoise(position / scale, frame);
    float coarse = valueNoise(position / (scale * 2.6) + 41.7, frame + 0.5);
    // Value noise has less variance than white noise; scale it back up to roughly +-0.5.
    float g = ((fine * 0.72 + coarse * 0.28) - 0.5) * 1.7;

    float luminance = dot(base, float3(0.299, 0.587, 0.114));
    float weight = mix(0.25, 1.0, 4.0 * luminance * (1.0 - luminance));
    float strength = g * amount * weight;

    float3 rgb;
    if (useSoftLight > 0.5) {
        rgb = softLight(base, clamp(float3(0.5 + strength * 0.5), 0.0, 1.0));
    } else {
        rgb = clamp(base + strength * 0.25, 0.0, 1.0);
    }
    return half4(half3(rgb * float(color.a)), color.a);
}
