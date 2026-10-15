#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// A studio for the metal to reflect, by reflection direction (y up, z toward the viewer): a bright sky, a hard
// horizon with a dark band under it, a dim floor and a soft box up and to the left. `flow` ripples the horizon with
// `t`, so the reflections slide across the letters like liquid metal.
static float3 mercuryStudio(float2 q, float t, float flow) {
    q.y += flow * (0.08 * sin(q.x * 3.3 + t * 1.2) + 0.04 * sin(q.x * 7.7 - t * 1.8 + q.y * 2.0));
    q.x += flow * 0.05 * sin(q.y * 3.9 - t * 0.9);
    float y = q.y;
    float sky = mix(0.66, 1.0, smoothstep(0.0, 0.75, y));
    float floorLight = mix(0.12, 0.36, smoothstep(0.0, -0.85, y));
    float v = mix(floorLight, sky, smoothstep(-0.012, 0.012, y));
    v += 0.4 * exp(-pow((y - 0.035) / 0.03, 2.0));
    v *= 1.0 - 0.55 * exp(-pow((y + 0.06) / 0.05, 2.0));
    float2 box = q - float2(-0.55, 0.6);
    v += 0.55 * exp(-dot(box, box) / 0.04);
    return v * mix(float3(1.0, 0.97, 0.93), float3(0.94, 0.97, 1.03), smoothstep(-0.2, 0.4, y));
}

// Turns whatever the layer draws (text, a symbol, any shape) into liquid metal. The view hands the layer over blurred
// by half the bevel, so its alpha is a smooth height field, high inside the shapes and falling through their edges;
// its gradient gives a bevel normal that reflects the studio, and the view masks the result back to the crisp shapes.
// The face reflects the horizon across the middle of the view, as chrome lettering does.
//
// size          the layer's size
// bevel         how far in from an edge the bevel reaches, in points
// touch, pull   a finger or pointer in the layer's coordinates, and how far (0-1) it slides the studio toward it
// tint          multiplies the reflections; white is chrome
// iridescence   thin-film strength on the bevel, 0-1
[[ stitchable ]] half4 mercuryText(float2 position, SwiftUI::Layer layer, float2 size, float bevel, float time, float flow, float2 touch, float pull, half4 tint, float iridescence) {
    if (layer.sample(position).a < 0.002h) { return half4(0.0h); }

    // Central differences of the blurred height a third of the bevel apart. The blur already smoothed the edge, so
    // four taps give a gradient that curves instead of terracing.
    float tap = max(bevel * 0.3, 0.5);
    float gx = float(layer.sample(position + float2(tap, 0.0)).a - layer.sample(position - float2(tap, 0.0)).a);
    float gy = float(layer.sample(position + float2(0.0, tap)).a - layer.sample(position - float2(0.0, tap)).a);
    // A blurred hard edge differs by about 0.48 across the taps at its steepest, so that leans the normal well over;
    // y flipped, since the layer is y-down.
    float2 slope = float2(gx, -gy) / 0.48;
    float3 n = normalize(float3(-slope * 2.2, 1.0));
    float3 refl = float3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);

    float face = (0.5 - position.y / max(size.y, 1.0)) * 0.9;
    float2 half_size = max(size * 0.5, float2(1.0));
    float2 light = clamp((touch - half_size) / half_size, -1.0, 1.0) * pull;
    float2 q = refl.xy + float2(0.0, face) + light * float2(-0.35, 0.35);
    float3 metal = mercuryStudio(q, time, flow) * float3(tint.rgb);

    // Thin film where the bevel is steep.
    float steep = 1.0 - n.z;
    float3 film = 0.5 + 0.5 * cos(6.2831853 * (refl.x * 0.9 + refl.y * 0.6 + time * 0.05 + float3(0.0, 0.33, 0.67)));
    metal = mix(metal, film * (0.65 + 0.45 * metal), clamp(iridescence * steep * 1.2, 0.0, 0.6));
    metal = clamp(metal, 0.0, 1.0);

    // Opaque: the view's mask brings back the shapes' own crisp, antialiased edges.
    return half4(half3(metal), 1.0h);
}
