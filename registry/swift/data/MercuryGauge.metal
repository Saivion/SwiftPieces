#include <metal_stdlib>
using namespace metal;

// The column of mercury: a capsule from its left end to `front`, whose rounded front leans forward as the level runs
// and rings after it lands. `lean` stretches the front cap along the run; `wobble` ripples its outline.
static float mercuryGaugeField(float2 p, float left, float front, float r, float lean, float wobble, float t) {
    float x = p.x;
    // The front cap, stretched by the lean: positive leans forward, negative drags back.
    if (x > front) { x = front + (x - front) / (1.0 + lean); }
    float2 q = float2(x - clamp(x, left, front), p.y);
    float d = length(q) - r;
    // Ripples on the front cap, dying away down the column.
    float ang = atan2(q.y, q.x);
    float onCap = smoothstep(front - r * 2.0, front, p.x);
    d += wobble * r * 0.12 * onCap * sin(ang * 3.0 + t * 19.0) * sin(t * 7.0);
    return d;
}

// A studio for the mercury to reflect, by reflection direction (y up, z toward the viewer).
static float3 mercuryGaugeStudio(float3 r, float t) {
    float2 q = r.xy;
    q.y += 0.05 * sin(q.x * 3.0 + t * 1.1);
    float y = q.y + 0.1 * q.x - 0.1;
    float sky = mix(0.72, 1.0, smoothstep(0.0, 0.8, y));
    float floorLight = mix(0.28, 0.48, smoothstep(0.0, -0.9, y));
    float v = mix(floorLight, sky, smoothstep(-0.08, 0.08, y));
    v += 0.25 * exp(-pow((y - 0.08) / 0.05, 2.0));
    v *= 1.0 - 0.3 * exp(-pow((y + 0.1) / 0.08, 2.0));
    float2 box = q - float2(-0.4, 0.6);
    v += 0.8 * exp(-dot(box, box) / 0.02);
    return v * mix(float3(1.0, 0.98, 0.95), float3(0.93, 0.96, 1.02), smoothstep(-0.2, 0.4, y));
}

// A column of mercury lying in a glass tube: rounded like a tube across its height, domed at its front, reflecting a
// studio, with a soft shadow under it. Everything else in the view is clear, so the tube shows through.
//
// size          the view, the tube's inside
// inset         the gap between the column and the tube's ends
// level         how full the tube is, 0-1; at 0 the column is a single drop
// radius        the column's half height
// lean, wobble  how far the front leans with the run, and how hard it rings after landing
// time          the ripple clock
// tint          multiplies the reflections
[[ stitchable ]] half4 mercuryGauge(float2 position, half4 color, float2 size, float inset, float level, float radius, float lean, float wobble, float time, half4 tint) {
    float2 p = float2(position.x, size.y * 0.5 - position.y);
    float left = inset + radius;
    float front = left + clamp(level, 0.0, 1.0) * max(size.x - 2.0 * left, 0.0);
    float d = mercuryGaugeField(p, left, front, radius, lean, wobble, time);

    float sd = mercuryGaugeField(p + float2(0.0, radius * 0.2), left, front, radius, lean, wobble, time);
    float shadow = 0.3 * exp(-max(sd, 0.0) / (radius * 0.25)) * smoothstep(-1.0, 1.0, d);
    if (d > 0.75) {
        return half4(0.0h, 0.0h, 0.0h, half(shadow)) * color.a;
    }

    const float e = 0.5;
    float2 g = float2(
        mercuryGaugeField(p + float2(e, 0.0), left, front, radius, lean, wobble, time) - mercuryGaugeField(p - float2(e, 0.0), left, front, radius, lean, wobble, time),
        mercuryGaugeField(p + float2(0.0, e), left, front, radius, lean, wobble, time) - mercuryGaugeField(p - float2(0.0, e), left, front, radius, lean, wobble, time)
    );
    float gl = length(g);
    g = gl > 0.0001 ? g / gl : float2(0.0, 1.0);

    // A liquid's profile: steep at its edge, flattening over the middle.
    float k = 1.0 - clamp(-d / radius, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    float3 n = normalize(float3(g * k, sqrt(max(1.0 - k * k, 0.0)) + 0.0001));
    float3 refl = float3(2.0 * n.z * n.x, 2.0 * n.z * n.y, 2.0 * n.z * n.z - 1.0);
    float3 metal = mercuryGaugeStudio(refl, time) * float3(tint.rgb);
    metal *= mix(1.0, 0.5, pow(k, 3.0));
    metal = clamp(metal, 0.0, 1.0);

    float cover = clamp(-d / 0.6 + 0.5, 0.0, 1.0);
    float3 rgb = metal * cover;
    float a = cover + shadow * (1.0 - cover);
    return half4(half3(rgb), half(a)) * color.a;
}
