#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// A studio for the metal to reflect, by reflection direction (y up, z toward the viewer): a bright sky, a hard
// horizon with a dark band under it, a dim floor and a soft box up and to the left. The horizon ripples with `t`, so
// the reflections slide over the molten symbol while it moves.
static float3 meltButtonStudio(float2 q, float t) {
    q.y += 0.07 * sin(q.x * 3.4 + t * 1.3) + 0.035 * sin(q.x * 8.1 - t * 1.9 + q.y * 2.0);
    float y = q.y;
    float sky = mix(0.66, 1.0, smoothstep(0.0, 0.75, y));
    float floorLight = mix(0.14, 0.38, smoothstep(0.0, -0.85, y));
    float v = mix(floorLight, sky, smoothstep(-0.015, 0.015, y));
    v += 0.4 * exp(-pow((y - 0.035) / 0.03, 2.0));
    v *= 1.0 - 0.5 * exp(-pow((y + 0.06) / 0.05, 2.0));
    float2 box = q - float2(-0.5, 0.6);
    v += 0.6 * exp(-dot(box, box) / 0.04);
    return v * mix(float3(1.0, 0.97, 0.93), float3(0.94, 0.97, 1.03), smoothstep(-0.2, 0.4, y));
}

// Molten metal from a blurred layer. The view draws the outgoing and incoming symbols over each other, blurred, so
// their alpha is a smooth field that melts from one shape into the other; this kernel cuts that field at 0.4, the
// surface of the liquid (a little under half, so thin strokes survive the blur), and shades what is inside as metal, beveled from the field's own slope.
//
// size     the layer's size
// sigma    the blur's radius in points, which sets how steep the field is at the surface
// time     the ripple clock
// tint     multiplies the reflections; white is chrome
[[ stitchable ]] half4 meltButton(float2 position, SwiftUI::Layer layer, float2 size, float sigma, float time, half4 tint) {
    float a = float(layer.sample(position).a);
    if (a < 0.12) { return half4(0.0h); }

    // The field's slope, by central differences, in alpha per point.
    float tap = max(sigma * 0.6, 0.5);
    float gx = float(layer.sample(position + float2(tap, 0.0)).a - layer.sample(position - float2(tap, 0.0)).a) / (2.0 * tap);
    float gy = float(layer.sample(position + float2(0.0, tap)).a - layer.sample(position - float2(0.0, tap)).a) / (2.0 * tap);
    float slope = length(float2(gx, gy));

    // The surface, antialiased over about a third of a point: distance to it is (a - 0.4) / slope.
    float cover = clamp((a - 0.4) / max(slope, 0.0005) * 1.5 + 0.5, 0.0, 1.0);
    if (cover <= 0.0) { return half4(0.0h); }

    // A blurred edge is steepest at the surface, about 0.4 / sigma, so this leans the normal well over there and lets
    // it come up flat over the middle. y flipped, since the layer is y-down.
    float k = 2.6 * sigma;
    float3 n = normalize(float3(-gx * k, gy * k, 1.0));
    float3 refl = float3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);

    // The face reflects the horizon across the middle of the button, as chrome lettering does.
    float face = (0.5 - position.y / max(size.y, 1.0)) * 0.8;
    float3 metal = meltButtonStudio(refl.xy + float2(0.0, face), time) * float3(tint.rgb);

    // A thin film where the liquid curls over its edge.
    float steep = 1.0 - n.z;
    float3 film = 0.5 + 0.5 * cos(6.2831853 * (refl.x * 0.9 + refl.y * 0.6 + time * 0.05 + float3(0.0, 0.33, 0.67)));
    metal = mix(metal, film * (0.65 + 0.45 * metal), clamp(steep * 0.35, 0.0, 0.3));
    metal = clamp(metal, 0.0, 1.0);
    return half4(half3(metal) * half(cover), half(cover));
}
