#include <metal_stdlib>
using namespace metal;

// The outline's signed distance: a rounded box with half size `b` and corner radius `r`, negative inside.
static float metalHaloBox(float2 p, float2 b, float r) {
    float2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// The ring's field: the outline, swollen toward the finger `f` by `pull`, so the ring bulges out where it is touched.
static float metalHaloField(float2 p, float2 b, float r, float2 f, float pull, float reach, float swell) {
    float2 k = p - f;
    return metalHaloBox(p, b, r) - pull * swell * exp(-dot(k, k) / (reach * reach));
}

// A studio for the metal to reflect, by reflection direction (y up, z toward the viewer): a bright sky, a hard
// horizon with a dark band under it, a dim floor and one soft box up and to the left. The horizon ripples with `t`,
// so the reflections slide like liquid metal instead of sitting still.
static float3 metalHaloStudio(float3 r, float t) {
    float2 q = r.xy;
    q.y += 0.06 * sin(q.x * 4.0 + t * 0.9) + 0.035 * sin(q.x * 9.0 - t * 1.4);
    float y = q.y + 0.05;
    float sky = mix(0.62, 0.98, smoothstep(0.0, 0.8, y));
    float floorLight = mix(0.07, 0.24, smoothstep(0.0, -0.9, y));
    float v = mix(floorLight, sky, smoothstep(-0.02, 0.02, y));
    v += 0.45 * exp(-pow((y - 0.05) / 0.035, 2.0));
    v *= 1.0 - 0.55 * exp(-pow((y + 0.08) / 0.06, 2.0));
    float2 box = q - float2(-0.55, 0.6);
    v += 0.6 * exp(-dot(box, box) / 0.04);
    // A cool sky and a warm floor, the way polished steel picks up a room.
    return v * mix(float3(1.0, 0.97, 0.93), float3(0.93, 0.97, 1.03), smoothstep(-0.2, 0.4, y));
}

// A ring of liquid metal along the inside of a rounded outline, with a hot spot that wanders around it, a soft bloom
// outside it, and a bulge toward the finger. The view is the outline plus `pad` on every side, where the bloom lives.
//
// size     the drawn view, outline plus pad
// radius   corner radius of the outline; negative means a capsule (or a circle, on a square)
// width    ring width in points
// phase    the wander clock; the hot spot rests up and to the left at 0
// touch    the finger in the view's coordinates; `pull` 0-1 is how hard it bends the ring and draws the hot spot
// glow     bloom strength; `energy` 0-1 dims the whole ring to plain steel when the control is inactive
[[ stitchable ]] half4 metalHalo(float2 position, half4 color, float2 size, float pad, float radius, float width, float phase, float2 touch, float pull, float glow, float energy, half4 glowTint) {
    float2 c = size * 0.5;
    float2 p = float2(position.x - c.x, c.y - position.y);
    float2 f = float2(touch.x - c.x, c.y - touch.y);
    float2 b = max(c - pad, float2(1.0));
    float r = radius < 0.0 ? min(b.x, b.y) : min(radius, min(b.x, b.y));
    float reach = max(min(b.x, b.y) * 0.9, 8.0);
    float swell = width * 1.6 + 1.5;

    // The field and its gradient, the outward direction across the ring.
    float d = metalHaloField(p, b, r, f, pull, reach, swell);
    const float e = 0.5;
    float2 g = float2(
        metalHaloField(p + float2(e, 0.0), b, r, f, pull, reach, swell) - metalHaloField(p - float2(e, 0.0), b, r, f, pull, reach, swell),
        metalHaloField(p + float2(0.0, e), b, r, f, pull, reach, swell) - metalHaloField(p - float2(0.0, e), b, r, f, pull, reach, swell)
    );
    float gl = length(g);
    g = gl > 0.0001 ? g / gl : float2(0.0, 1.0);

    // A round tube: across the band `s` runs -1 at its inner edge to 1 at the outline.
    float hw = max(width * 0.5, 0.5);
    float s = clamp((d + hw) / hw, -1.0, 1.0);
    float3 n = normalize(float3(g * s, sqrt(max(1.0 - s * s, 0.0)) + 0.0001));
    float3 refl = float3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
    float3 ring = metalHaloStudio(refl, phase) * mix(0.42, 1.0, energy);

    // The hot spot wanders from up-left, and leans toward the finger as `pull` rises.
    float wander = 2.3562 + 0.8 * phase + 0.45 * sin(0.55 * phase);
    float aim = atan2(f.y, f.x);
    float hot = wander + atan2(sin(aim - wander), cos(aim - wander)) * pull;
    float theta = atan2(p.y, p.x);
    float dh = atan2(sin(theta - hot), cos(theta - hot));
    float lobe = exp(-dh * dh / 0.18);
    float back = exp(-pow(abs(dh) - M_PI_F, 2.0) / 0.12) * 0.35;
    ring += energy * (lobe * 1.1 + back) * (0.55 + 0.45 * n.z);

    // Thin-film colour where the hot spot falls away: a hint of spectrum on either side of it.
    float3 film = 0.5 + 0.5 * cos(6.2831853 * (dh * 0.55 + refl.x * 0.25 + float3(0.0, 0.33, 0.67)));
    float fringe = exp(-pow(abs(dh) - 0.6, 2.0) / 0.05);
    ring = mix(ring, film, energy * fringe * 0.5 * (0.45 + 0.55 * (1.0 - n.z)));
    ring = clamp(ring, 0.0, 1.0);

    // Coverage, antialiased over about half a point.
    float cover = clamp((hw - abs(d + hw)) / 0.6 + 0.5, 0.0, 1.0);

    // Bloom outside the outline, strongest under the hot spot.
    // It fades out before the view's edge, so the bloom never shows the box it is drawn in.
    float edge = min(c.x - abs(p.x), c.y - abs(p.y));
    float bloom = glow * energy * (lobe + back * 0.5) * exp(-max(d, 0.0) / max(pad * 0.3, 1.0)) * smoothstep(-1.0, 1.0, d) * smoothstep(0.0, pad * 0.6, edge);
    float ga = clamp(bloom * 0.7, 0.0, 1.0);

    float3 rgb = ring * cover + float3(glowTint.rgb) * ga * (1.0 - cover);
    float a = cover + ga * (1.0 - cover);
    return half4(half3(rgb), half(a)) * color.a;
}
