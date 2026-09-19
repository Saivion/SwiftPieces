#include <metal_stdlib>
using namespace metal;

// Fold height field: layered sines under a slow domain rotation, plus a finer warped ripple for thread-like detail.
static float silkHeight(float2 uv, float t) {
    float a = 0.35 * t;
    float2x2 rot = float2x2(cos(a), -sin(a), sin(a), cos(a));
    float2 p = rot * uv;

    float v = sin(p.x * 3.0 + t);
    v += sin((p.y + p.x) * 2.0 - t * 1.3) * 0.8;
    // The radial term is centred off-screen so its origin never shows as a pinch in the middle of the view.
    v += sin(length(p - float2(1.7, -1.3)) * 4.0 - t * 0.7) * 0.6;
    v += sin(p.y * 6.0 + sin(p.x * 2.0 + t * 0.4) * 1.5 - t * 0.5) * 0.3;
    return v / 2.7;
}

// Silk shaded with Blinn-Phong against a screen-space light. The normal comes from two extra height samples.
[[ stitchable ]] half4 silk(float2 position, half4 color, float2 size, float time, half4 tint, half4 sheen, float scale, float2 light, float depth, float shine) {
    float2 uv = (position / size - 0.5) * scale;
    float t = time * 0.3;

    // Gradient normal: sample the height field at the pixel and one step along each axis.
    const float e = 0.006;
    const float bump = 0.05 * scale;
    float h  = silkHeight(uv, t);
    float hx = silkHeight(uv + float2(e, 0.0), t);
    float hy = silkHeight(uv + float2(0.0, e), t);
    float3 n = normalize(float3(-(hx - h) / e * bump, -(hy - h) / e * bump, 1.0));

    // Light direction from the unit-point light towards the surface; y is flipped because the view is y-down.
    float3 L = normalize(float3((light.x - 0.5) * 2.0, -(light.y - 0.5) * 2.0, 0.9));
    float3 V = float3(0.0, 0.0, 1.0);
    float3 H = normalize(L + V);

    float diffuse = max(dot(n, L), 0.0);
    float spec = pow(max(dot(n, H), 0.0), shine);

    // Anisotropic touch: highlights stretch along the fold direction by mixing in the height itself.
    float sheenAmount = spec * (0.45 + 0.25 * h);

    float3 base = float3(tint.rgb) * (1.0 - depth + depth * diffuse);
    float3 rgb = base + float3(sheen.rgb) * sheenAmount;
    return half4(half3(rgb), 1.0h) * color.a;
}
