#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// Distortion Wave: a ring of glass that opens from a point. Inside the ring the new screen is magnified toward
// the rim, as under the curved edge of a lens; just outside it the old screen is drawn in toward the ring. The
// colour channels bend by slightly different amounts, so the rim splits light a little, and a thin highlight runs
// along the edge. Helpers are file-local (static) so the kernels can share a target with other shaders.

namespace distortionWave {

/// The band narrows while the ring is small, so it never folds over its own centre.
static float bandFor(float radius, float band) {
    return band * min(1.0, radius / (2.0 * band)) + 1.0;
}

/// Samples the layer with each colour channel bent by a slightly different amount.
static half4 split(SwiftUI::Layer layer, float2 position, float2 direction, float shift) {
    float spread = shift * 0.12;
    half4 r = layer.sample(position - direction * (shift + spread));
    half4 g = layer.sample(position - direction * shift);
    half4 b = layer.sample(position - direction * (shift - spread));
    return half4(r.r, g.g, b.b, g.a);
}

/// Adds the rim's highlight (and a faint glow inside it) and the soft shade just outside it.
static half4 light(half4 color, float q, float s, bool inside) {
    float rim = 1.4;
    float highlight = exp(-(q * q) / (2.0 * rim * rim)) * 0.7 + (inside ? 0.10 * s * s * s : 0.0);
    float shade = inside ? 0.0 : 0.10 * s * s;
    half3 rgb = mix(color.rgb, half3(color.a), half(highlight));
    return half4(rgb * half(1.0 - shade), color.a);
}

}

// The screen being left: hidden inside the ring, drawn in toward it just outside.
[[ stitchable ]] half4 distortionWaveOld(float2 position, SwiftUI::Layer layer, float2 center, float radius, float band) {
    if (radius <= 0.0) { return layer.sample(position); }
    float2 offset = position - center;
    float d = max(length(offset), 1.0);
    float q = d - radius;
    if (q < 0.0) { return half4(0.0); }
    float width = distortionWave::bandFor(radius, band);
    if (q >= width) { return layer.sample(position); }
    float2 direction = offset / d;
    float s = 1.0 - q / width;
    half4 color = distortionWave::split(layer, position, direction, -width * 0.38 * s * s);
    return distortionWave::light(color, q, s, false);
}

// The screen arriving: shown inside the ring, magnified toward its rim.
[[ stitchable ]] half4 distortionWaveNew(float2 position, SwiftUI::Layer layer, float2 center, float radius, float band) {
    float2 offset = position - center;
    float d = max(length(offset), 1.0);
    float q = d - radius;
    if (q >= 0.0) { return half4(0.0); }
    float width = distortionWave::bandFor(radius, band);
    if (q <= -width) { return layer.sample(position); }
    float2 direction = offset / d;
    float s = 1.0 + q / width;
    half4 color = distortionWave::split(layer, position, direction, min(width * 0.55 * s * s, d * 0.8));
    return distortionWave::light(color, q, s, true);
}
