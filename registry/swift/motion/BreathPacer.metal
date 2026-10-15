#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// An aura: four colour pools drifting on slow closed paths over a wash of their average, blended by soft weights the
// way a mesh gradient blends its points, with a little grain so it never bands. Every path runs at a whole-number
// rate on one phase, so the loop has no seam when the view wraps the phase at 2π.
//
// bounds   the shape's bounding rect in points, from `.boundingRect`
// phase    the loop's phase, 0 to 2π, advanced by the view
// energy   0 at rest to 1 at full: the pools wander off their paths, tighten and brighten
// scale    how much of the aura shows across the layer's longer side; larger shows more pools at once
// c0...c3  the pool colours
[[ stitchable ]] half4 breathPacer(float2 position, half4 color, float4 bounds, float phase, float energy, float scale, half4 c0, half4 c1, half4 c2, half4 c3) {
    if (color.a <= 0.0h) { return half4(0.0h); }
    float2 size = bounds.zw;
    float side = max(max(size.x, size.y), 1.0);
    float2 p = (position - bounds.xy - size * 0.5) / side * scale;

    float3 pools[4] = { float3(c0.rgb), float3(c1.rgb), float3(c2.rgb), float3(c3.rgb) };
    float2 rates[4] = { float2(3.0, 2.0), float2(2.0, 5.0), float2(4.0, 3.0), float2(5.0, 4.0) };
    float3 wash = (pools[0] + pools[1] + pools[2] + pools[3]) * 0.25;
    float3 sum = wash * 0.5;
    float total = 0.5;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float2 centre = 0.42 * float2(sin(phase * rates[i].x + fi * 1.9), cos(phase * rates[i].y + fi * 2.7));
        // With energy the pools leave their paths on a quicker wander, so a busy aura churns rather than just speeds up.
        centre += 0.12 * energy * float2(sin(phase * (13.0 + fi) + fi), cos(phase * (11.0 + fi) + fi * 1.3));
        float2 d = p - centre;
        float w = exp(-dot(d, d) / (0.16 + 0.06 * energy));
        sum += pools[i] * w;
        total += w;
    }
    float3 aura = sum / total * (1.0 + 0.12 * energy);
    float grain = fract(sin(dot(position, float2(127.1, 311.7))) * 43758.5453) - 0.5;
    aura = clamp(aura + grain * 0.02, 0.0, 1.0);
    return half4(half3(aura) * color.a, color.a);
}
