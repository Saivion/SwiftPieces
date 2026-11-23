#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// Distortion Wave: a ring of refraction that opens from a point. The old screen draws outside the
// ring, pulled in toward it as if seen through the lens; the new screen draws inside, pushed out.
// Across the ring's edge a warm fringe (pink, orange, red) shimmers with the angle and the time.
// Helpers are file-local (static) so the kernels can share a target with other shaders.

namespace distortionWave {

static half3 fringe(float t) {
    const half3 pink = half3(1.0, 0.757, 0.839);
    const half3 orange = half3(1.0, 0.541, 0.361);
    const half3 red = half3(0.949, 0.212, 0.110);
    t = clamp(t, 0.0, 1.0) * 2.0;
    return t < 1.0 ? mix(pink, orange, half(t)) : mix(orange, red, half(t - 1.0));
}

static half4 shade(half4 color, float2 offset, float q, float inner, float outer, float time) {
    if (q < -inner || q > outer) { return color; }
    float edge = q < 0.0 ? 1.0 + q / inner : 1.0 - q / outer;
    float angle = atan2(offset.y, offset.x);
    half3 warm = fringe(0.2 + 0.6 * (0.5 + 0.5 * sin(angle * 2.0 + time * 1.5)));
    half amount = half(edge * 0.9) * color.a;
    return half4(mix(color.rgb, warm * color.a, amount), color.a);
}

}

// The screen being left: hidden inside the ring, bent toward it just outside.
[[ stitchable ]] half4 distortionWaveOld(float2 position, SwiftUI::Layer layer, float2 center, float radius, float band, float time) {
    float2 offset = position - center;
    float d = max(length(offset), 1.0);
    float2 direction = offset / d;
    float q = d - radius;
    if (radius <= 0.0) { return layer.sample(position); }
    if (q < 0.0) { return half4(0.0); }
    float2 source = position;
    if (q < band) { source -= direction * (band - q) * 0.6; }
    return distortionWave::shade(layer.sample(source), offset, q, band * 0.4, band * 0.3, time);
}

// The screen arriving: shown inside the ring, pushed out toward its edge.
[[ stitchable ]] half4 distortionWaveNew(float2 position, SwiftUI::Layer layer, float2 center, float radius, float band, float time) {
    float2 offset = position - center;
    float d = max(length(offset), 1.0);
    float2 direction = offset / d;
    float q = d - radius;
    if (q >= 0.0) { return half4(0.0); }
    float2 source = position;
    if (q > -band) { source += direction * (band + q) * 0.5; }
    return distortionWave::shade(layer.sample(source), offset, q, band * 0.4, band * 0.3, time);
}
