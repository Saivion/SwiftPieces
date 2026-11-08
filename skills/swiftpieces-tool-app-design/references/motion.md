# Motion in SwiftUI

Run the frequency gate and name the purpose (the Motion laws in SKILL.md) before reading on. Most screens need less motion than you think.

## Vocabulary

Pick one set per app and name it. With SwiftPieces Pro use `theme.motion` (`snappy`, `smooth`, `bouncy`, `standard`, `hero`) through `theme.motion.adapted(_:reduceMotion:)`. Without it:

```swift
extension Animation {
    static let settle = Animation.spring(duration: 0.4, bounce: 0)        // things coming to rest
    static let thrown = Animation.spring(duration: 0.3, bounce: 0.2)      // released with momentum
    static let press = Animation.spring(duration: 0.15, bounce: 0)        // press-in and press-out
    static let enter = Animation.timingCurve(0.23, 1, 0.32, 1, duration: 0.25)   // strong ease-out
    static let exit = Animation.timingCurve(0.23, 1, 0.32, 1, duration: 0.18)
}
```

Never ease-in on an entrance. Never more than 300 ms for a timed animation, 400 ms for a settle.

## Press feedback

```swift
struct PressScale: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.press, value: configuration.isPressed)
    }
}
```

Buttons and cards scale. List rows highlight their background instead. Toolbar buttons keep the system style.

## Gestures

Follow the finger 1:1, then let momentum choose the target and a spring finish the job.

```swift
struct DismissibleCard: View {
    @State private var offset: CGFloat = 0
    let onDismiss: () -> Void

    var body: some View {
        Card()
            .offset(y: offset)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        let y = value.translation.height
                        offset = y > 0 ? y : y / 4            // rubber-band upward, past the bound
                    }
                    .onEnded { value in
                        if value.predictedEndTranslation.height > 200 {   // a flick commits
                            withAnimation(.thrown) { offset = 900 } completion: { onDismiss() }
                        } else {
                            withAnimation(.settle) { offset = 0 }
                        }
                    }
            )
    }
}
```

- SwiftUI springs keep velocity when retargeted, so a new drag can grab a moving view. Don't block input until an animation completes.
- Keep drag state local (`@State` in the small view, or `@GestureState` when it should reset) so a drag invalidates only that view.
- `value.velocity` (iOS 17) gives release speed if you need it for a threshold.
- Bounce only when the release carried momentum; a slow drop settles with no overshoot.

## Transitions

```swift
.transition(.asymmetric(
    insertion: .scale(scale: 0.95).combined(with: .opacity).animation(.enter),
    removal: .opacity.animation(.exit)))
```

- Enter from 0.95, never from 0. Exits are faster and leave the way they came.
- Menus and popovers grow from their trigger (`.scale(scale: 0.95, anchor: .topTrailing)`); centred modals are exempt.
- Changing numbers: `.contentTransition(.numericText(value:))` with `.monospacedDigit()`. Symbols: `.contentTransition(.symbolEffect(.replace))`.
- Continuity between a thumbnail and its detail: on iOS 18, `.matchedTransitionSource(id:in:)` on the source and `.navigationTransition(.zoom(sourceID:in:))` on the destination, inside `if #available`. Within one screen, `matchedGeometryEffect`.

## Continuous and shader motion

- `TimelineView(.animation)` plus `Canvas` or a Metal shader (`.colorEffect`, `.layerEffect`, `.distortionEffect`) for anything that runs every frame. Pause it when off screen and under Reduce Motion.
- Ambient motion lives on one surface per screen at most (a hero, an empty state), never behind text people are reading.

## Keyboard

- Let SwiftUI avoid the keyboard. Composers go in `.safeAreaInset(edge: .bottom)`.
- `.scrollDismissesKeyboard(.interactively)` on scroll views with inputs; `@FocusState` to move focus and `.onSubmit` to advance.
- Never observe keyboard notifications to animate with a guessed duration.

## Reduce Motion

```swift
@Environment(\.accessibilityReduceMotion) private var reduceMotion

withAnimation(reduceMotion ? .easeInOut(duration: 0.2) : .thrown) { … }
.transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
```

Spatial motion becomes a cross-fade, parallax and ambient loops stop, system transitions stay the system's.

## Performance

- Animate `scaleEffect`, `offset`, `rotationEffect`, `opacity` and shader uniforms. Animating `frame`, `padding` or a container's layout re-lays out the subtree every frame.
- Never animate a header's height; translate content inside a fixed clip.
- Avoid `.animation(_:)` without `value:`; scope animations to the value that changed.
- No implicit animations on rows of a long list.
