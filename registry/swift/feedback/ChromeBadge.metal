#include <metal_stdlib>
using namespace metal;

// A bright studio for the chrome to reflect, by reflection direction (y up, z toward the viewer): a white sky, a hard
// horizon with a soft grey band under it, a pale floor and a soft box up and to the left. Kept light, so dark ink
// reads anywhere on the face. `flow` ripples the horizon with
// `t`, so the reflections slide over the badge like liquid metal.
static float3 chromeBadgeStudio(float2 q, float t, float flow) {
    q.y += flow * (0.07 * sin(q.x * 3.6 + t * 1.1) + 0.04 * sin(q.x * 8.2 - t * 1.6 + q.y * 2.0));
    q.x += flow * 0.05 * sin(q.y * 4.0 - t * 0.8);
    float y = q.y;
    float sky = mix(0.86, 1.0, smoothstep(0.0, 0.7, y));
    float floorLight = mix(0.6, 0.78, smoothstep(0.0, -0.8, y));
    float v = mix(floorLight, sky, smoothstep(-0.015, 0.015, y));
    v += 0.2 * exp(-pow((y - 0.04) / 0.03, 2.0));
    v *= 1.0 - 0.3 * exp(-pow((y + 0.07) / 0.05, 2.0));
    float2 box = q - float2(-0.5, 0.55);
    v += 0.35 * exp(-dot(box, box) / 0.05);
    // The bevel looks out past the room's walls into a darker surround, which outlines the badge.
    v *= mix(1.0, 0.45, smoothstep(0.75, 1.0, length(q)));
    return float3(v);
}

// A capsule of polished liquid metal: a rounded bevel round its edge, a gently domed face, reflections that flow,
// a thin-film fringe on the bevel, a glint that sweeps across, and a soft bloom outside. The view is the capsule plus
// `pad` on every side, where the bloom lives.
//
// tint          the metal's colour; white is chrome
// iridescence   thin-film strength on the bevel, 0-1
// glint         where the sweep is, -1.6 (off the left) to 1.6 (off the right)
// glow          bloom strength; `glowTint` its colour
[[ stitchable ]] half4 chromeBadge(float2 position, half4 color, float2 size, float pad, float time, float flow, float glint, half4 tint, float iridescence, float glow, half4 glowTint) {
    float2 c = size * 0.5;
    float2 p = float2(position.x - c.x, c.y - position.y);
    float2 b = max(c - pad, float2(1.0));
    float r = min(b.x, b.y);

    // The capsule's distance and outward direction from its spine.
    float2 spine = float2(clamp(p.x, -(b.x - r), b.x - r), 0.0);
    float2 away = p - spine;
    float len = length(away);
    float d = len - r;
    float2 g = len > 0.0001 ? away / len : float2(0.0, 1.0);

    // A round bevel over the outer 55% of the half height, then a slightly domed face.
    float depth = max(-d, 0.0);
    float bevel = r * 0.55;
    float k = 1.0 - clamp(depth / bevel, 0.0, 1.0);
    float3 n = float3(g * k, sqrt(max(1.0 - k * k, 0.0)));
    n.xy += float2(p.x / b.x * 0.08, p.y / b.y * 0.18) * (1.0 - k);
    n = normalize(n);
    float3 refl = float3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);

    // The face reflects a horizon low across it, as chrome lettering does, so the label sits on bright sky; the bevel
    // reflects the room.
    float2 q = refl.xy + float2(0.0, p.y / b.y * 0.35 + 0.18);
    float3 metal = chromeBadgeStudio(q, time, flow) * float3(tint.rgb);

    // Thin film on the bevel, drifting slowly so the spectrum moves with the metal.
    float3 film = 0.5 + 0.5 * cos(6.2831853 * (refl.x * 0.8 + refl.y * 0.5 + time * 0.05 + float3(0.0, 0.33, 0.67)));
    metal = mix(metal, film * (0.75 + 0.35 * metal), iridescence * pow(k, 1.4) * 0.5);

    // The glint: a soft diagonal band.
    float u = p.x / b.x + p.y / b.y * 0.45;
    metal += 0.55 * exp(-pow((u - glint) / 0.16, 2.0));

    // A darker lip right at the edge, so the badge reads on a light ground too.
    metal *= mix(1.0, 0.62, smoothstep(-1.4, 0.0, d));
    metal = clamp(metal, 0.0, 1.0);

    float cover = clamp(-d / 0.6 + 0.5, 0.0, 1.0);
    float lean = 0.55 + 0.45 * dot(normalize(p + float2(0.0001)), float2(-0.7071, 0.7071));
    // It fades out before the view's edge, so the bloom never shows the box it is drawn in.
    float edge = min(c.x - abs(p.x), c.y - abs(p.y));
    float bloom = glow * lean * exp(-max(d, 0.0) / max(pad * 0.3, 1.0)) * smoothstep(-1.0, 1.0, d) * smoothstep(0.0, pad * 0.6, edge);
    float ga = clamp(bloom * 0.55, 0.0, 1.0);

    float3 rgb = metal * cover + float3(glowTint.rgb) * ga * (1.0 - cover);
    float a = cover + ga * (1.0 - cover);
    return half4(half3(rgb), half(a)) * color.a;
}
