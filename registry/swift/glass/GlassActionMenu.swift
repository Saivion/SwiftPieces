// swiftpieces:
// title: Glass Action Menu
// description: A liquid glass action menu. Hold the signal trigger and its actions bud out of it along a line or an arc, each born inside it and pulling a neck that thins and snaps, with its name budding from its side; slide across them and release to fire. The others melt home first and the fired one last, as the trigger lands a check; a tap toggles and a scrim dismisses.
// category: glass
// minIOSVersion: "17.0"
// version: "2.3.0"
// pro: morph-nav
// tags: [menu, glass, morph, fab, long-press, haptics]

import SwiftUI

/// Floating liquid glass action menu with a hold-slide-release gesture, a dimming scrim and a confirming trigger.
///
/// The trigger and its actions are glass bubbles in one liquid group. The actions rest apart, from the trigger and from
/// each other. Opening, each one buds out of the trigger: born inside it, it pulls a liquid neck that thins and snaps
/// as it springs to its place, and its name buds from its side and stays joined to it by a neck. Closing, the names
/// melt into their actions and the actions melt home, farthest first; after a fire the chosen action melts home last.
///
/// - Parameters:
///   - items: Actions in emergence order (nearest to the trigger first). Give an item a `tint` to tint its glass.
///   - triggerSymbol: SF Symbol on the collapsed trigger. Rotates 45° while open (under Reduce Motion it swaps to a close mark instead).
///   - arrangement: `.linear` stacks items upward; `.arc` fans them from up to leading, for a bottom-trailing placement.
///   - tint: Trigger glass tint. `nil` uses `style.trigger`, the house signal red. Items keep their own tints so the trigger reads as the anchor.
///   - isExpanded: Optional binding to open or close the menu programmatically; it is written back when the user toggles it.
///   - style: Trigger tint, inks, sizes, scrim strength and the confirmation check.
public struct GlassActionMenu: View {
    public struct Item: Identifiable {
        public let id = UUID()
        public let symbol: String
        public let label: String
        /// Glass tint for this action, with `Style.ink` on it. `nil` keeps it neutral glass. Tint only to say
        /// something, such as butter for a destructive action.
        public let tint: Color?
        public let action: () -> Void

        public init(symbol: String, label: String, action: @escaping () -> Void) {
            self.init(symbol: symbol, label: label, tint: nil, action: action)
        }

        public init(symbol: String, label: String, tint: Color?, action: @escaping () -> Void) {
            self.symbol = symbol
            self.label = label
            self.tint = tint
            self.action = action
        }
    }

    public enum Arrangement { case linear, arc }
    public enum Phase { case collapsed, expanding, open, hovering, firing, collapsing }

    /// Visual tuning. `standard` uses the house palette: a signal trigger with the house ink, and neutral glass names.
    public struct Style: Sendable {
        /// Trigger glass tint when `tint` is `nil`.
        public var trigger: Color
        /// Symbol color on the trigger and on tinted items.
        public var ink: Color
        /// Unused since the liquid glass refactor: names are neutral glass that bud from their actions. Kept so
        /// existing code still compiles.
        public var labelFill: Color
        /// Name text color, and the ring Reduce Motion draws around the targeted action.
        public var labelInk: Color
        /// Diameter of the trigger.
        public var triggerSize: CGFloat
        /// Diameter of each item.
        public var itemSize: CGFloat
        /// Opacity of the black scrim while open.
        public var scrimOpacity: Double
        /// When true, the trigger shows a checkmark for a moment after an action fires.
        public var confirmsAction: Bool

        public init(
            trigger: Color = Color(red: 1, green: 0, blue: 0),
            ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078),
            labelFill: Color = Color(UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
                ? UIColor(red: 0.149, green: 0.149, blue: 0.149, alpha: 1)
                : .white }),
            labelInk: Color = Color(UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
                ? UIColor(red: 0.957, green: 0.953, blue: 0.937, alpha: 1)
                : UIColor(red: 0.078, green: 0.078, blue: 0.078, alpha: 1) }),
            triggerSize: CGFloat = 64,
            itemSize: CGFloat = 60,
            scrimOpacity: Double = 0.28,
            confirmsAction: Bool = true
        ) {
            self.trigger = trigger
            self.ink = ink
            self.labelFill = labelFill
            self.labelInk = labelInk
            self.triggerSize = triggerSize
            self.itemSize = itemSize
            self.scrimOpacity = scrimOpacity
            self.confirmsAction = confirmsAction
        }

        public static let standard = Style()
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: Phase = .collapsed
    /// The actions: born inside the trigger, out at their places while the menu is open, melted home to close.
    @State private var buds = PieceBuds()
    /// The names: each buds from its own action once that action is nearly out, and melts back into it first.
    @State private var names = PieceBuds()
    @State private var hovered: Int?
    @State private var triggerPressed = false
    @State private var longPressed = false
    @State private var hoverTicks = 0
    @State private var fireTicks = 0
    @State private var confirming = false
    /// The fired action, held swollen until it is home in the trigger. It melts in last.
    @State private var returning: Int?
    /// How far the hovered action leans toward the finger. Visual only: hits use the fixed targets.
    @State private var hoverLean: CGSize = .zero
    /// Resets when the system cancels a touch, which skips onEnded.
    @GestureState private var touching = false
    @State private var pressTask: Task<Void, Never>?
    @State private var choreography: Task<Void, Never>?

    private let items: [Item]
    private let triggerSymbol: String
    private let arrangement: Arrangement
    private let tint: Color?
    private let isExpanded: Binding<Bool>?
    private let style: Style
    private var triggerSize: CGFloat { style.triggerSize }
    private var itemSize: CGFloat { style.itemSize }
    /// Separate actions rest apart, outside the merge distance, so each is its own bubble and only goos while it buds.
    private let spacing = PieceLiquid.apart
    private static let space = "GlassActionMenu"

    public init(items: [Item], triggerSymbol: String = "plus", arrangement: Arrangement = .linear, tint: Color? = nil, isExpanded: Binding<Bool>? = nil, style: Style = .standard) {
        self.items = items
        self.triggerSymbol = triggerSymbol
        self.arrangement = arrangement
        self.tint = tint
        self.isExpanded = isExpanded
        self.style = style
    }

    private var isOpen: Bool { phase != .collapsed && phase != .collapsing }

    public var body: some View {
        PieceLiquidGroup {
            ZStack {
                // Keyed by position. Items built in the parent's body get fresh ids on every update, and keying by id
                // would replace each action mid-spring whenever the parent redraws.
                ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                    if buds.contains(Self.action(index)) {
                        itemView(index, item)
                    }
                }
                // Last, so an action at home sits under it.
                trigger
            }
        }
        .frame(width: triggerSize, height: triggerSize)
        .fontWeight(.semibold)
        .coordinateSpace(.named(Self.space))
        .background { scrim }
        .sensoryFeedback(.selection, trigger: hoverTicks)
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: fireTicks)
        .sensoryFeedback(.impact(flexibility: .soft), trigger: longPressed) { _, new in new }
        .onChange(of: isExpanded?.wrappedValue) { _, new in
            guard let new, new != isOpen else { return }
            new ? expand() : collapse()
        }
        .accessibilityElement(children: .contain)
    }

    private static func action(_ index: Int) -> String { "action\(index)" }
    private static func name(_ index: Int) -> String { "name\(index)" }

    // MARK: Items

    @ViewBuilder private func itemView(_ index: Int, _ item: Item) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let out = buds.isOut(Self.action(index))
        let lifted = hovered == index || returning == index
        // The fired action keeps its swell until it is home.
        let scale: CGFloat = returning == index ? 1.2 : lifted ? 1.12 : 1
        itemButton(index, item, out: out)
            // A tinted action drains to clear glass as it melts home, so its color never sits on the trigger.
            .pieceLiquid(.circle, tint: out ? item.tint : nil, interactive: false)
            // Reduce Motion rings the targeted action instead of lifting it.
            .overlay(Circle().strokeBorder(style.labelInk, lineWidth: 2.5).opacity(reduceMotion && lifted ? 1 : 0).allowsHitTesting(false))
            // Through the glass, so the symbol swells with its bubble (a scaleEffect on glass leaves it behind).
            .pieceLiquidScale(reduceMotion ? 1 : scale)
            .offset(hovered == index && phase == .hovering && !reduceMotion ? hoverLean : .zero)
            // Only a change of lift animates, so the lean eases in with the lift, then tracks the finger directly.
            .animation(liftAnimation(scale, motion), value: scale)
            // Behind the action, so its symbol stays on top while the name is home inside it. The name rides the
            // action's own bud, so it goes wherever the action goes.
            .background {
                if names.contains(Self.name(index)) {
                    nameView(item.label, out: names.isOut(Self.name(index)), above: nameAbove(index))
                }
            }
            .pieceBud(out: out, rest: target(index), home: home(index))
            .zIndex(lifted ? 2 : 1)
            // A bubble on its way out or home takes no taps; the trigger above it owns the touch.
            .allowsHitTesting(out)
            .accessibilityHidden(!out)
    }

    /// Names sit leading of their item, except the item straight above the trigger in an arc, whose name sits above it so it never crosses its neighbour.
    private func nameAbove(_ index: Int) -> Bool {
        arrangement == .arc && index == 0 && items.count > 2
    }

    /// A hovered action lifts, and a fired one swells, with the elastic give the slide or the tap put in. The lift
    /// drops away firmly.
    private func liftAnimation(_ scale: CGFloat, _ motion: PieceMotion) -> Animation {
        scale > 1 ? motion.follow(PieceMotion.elastic, rank: 0) : motion.dismiss
    }

    private func itemButton(_ index: Int, _ item: Item, out: Bool) -> some View {
        Button { fire(index) } label: {
            Image(systemName: item.symbol)
                .font(.title2.weight(.semibold))
                .foregroundStyle(item.tint == nil ? AnyShapeStyle(.primary) : AnyShapeStyle(style.ink))
                .pieceBudContent(out: out)
                .frame(width: itemSize, height: itemSize)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.label)
    }

    /// An action's name on neutral glass, joined to it by a neck. It buds from the action's centre to its place beside
    /// the action: home, it is squeezed narrow as well as shrunk, so even a long name is born wholly inside its action,
    /// and it stretches out to full width as it leaves.
    private func nameView(_ text: String, out: Bool, above: Bool) -> some View {
        // Laid out centred on the action. Its place is half the name's size plus the neck and the action's radius
        // away, and the name's size is known only once it is laid out, so the place is worked out where it renders.
        // (Not an alignment guide: the name is inside an `if`, where a guide is ignored.)
        let reach = PieceLiquid.joined + itemSize / 2
        let homeScale = PieceLiquid.homeScale
        // The widest a name may be at home and still sit inside its action.
        let snug = itemSize * 0.66
        let home = !out && !reduceMotion
        return Text(text)
            .font(.body.weight(.semibold))
            .foregroundStyle(style.labelInk)
            .lineLimit(1)
            .fixedSize()
            .pieceBudContent(out: out)
            .padding(.horizontal, 16)
            // Two thirds of its action's height, so the neck between them reads full and the pair reads as one shape.
            .frame(minHeight: (itemSize * 2 / 3).rounded())
            .pieceLiquid(.capsule, interactive: false)
            .pieceBud(out: out, home: .zero)
            .visualEffect { content, proxy in
                let size = proxy.size
                let squeeze = home ? min(1, snug / max(size.width * homeScale, 1)) : 1
                let place = home ? CGSize.zero : above ? CGSize(width: 0, height: -(size.height / 2 + reach)) : CGSize(width: -(size.width / 2 + reach), height: 0)
                return content
                    .scaleEffect(x: squeeze, y: 1)
                    .offset(place)
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    // MARK: Trigger

    /// What the trigger shows: its symbol at rest, a close mark while open and while the fired action is on its way
    /// home, then a check.
    private enum TriggerGlyph { case rest, open, confirm }

    private var triggerGlyph: TriggerGlyph {
        if confirming { return .confirm }
        return isOpen || returning != nil ? .open : .rest
    }

    /// Turns to close on the snap a tap expects, lands the check as the outcome, and turns back firmly.
    private func glyphAnimation(_ glyph: TriggerGlyph, _ motion: PieceMotion) -> Animation {
        switch glyph {
        case .open: motion.snap
        case .confirm: motion.success
        case .rest: motion.dismiss
        }
    }

    @ViewBuilder private var trigger: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let glyph = triggerGlyph
        let symbol = glyph == .confirm ? "checkmark" : glyph == .open && reduceMotion ? "xmark" : triggerSymbol
        ZStack {
            // A new symbol blurs in as the old one blurs out. The open turn is a rotation of the same symbol.
            Image(systemName: symbol)
                .font(.title2.weight(.semibold))
                .foregroundStyle(style.ink)
                .id(symbol)
                .transition(motion.swap)
        }
        // Under Reduce Motion the close mark is swapped in rather than turned to.
        .rotationEffect(.degrees(glyph == .open && !reduceMotion ? 45 : 0))
        .animation(glyphAnimation(glyph, motion), value: glyph)
        .frame(width: triggerSize, height: triggerSize)
        .contentShape(Circle())
        // The trigger's own press below is the press, so the glass doesn't swell under it as well.
        .pieceLiquid(.circle, tint: tint ?? style.trigger, interactive: false)
        // Sinks to 0.92 without bouncing and springs back on release. Under Reduce Motion it shades instead (darker in
        // light mode, lighter in dark). The liquid press, so the symbol sinks with its glass.
        .pieceLiquidPress(triggerPressed)
        .gesture(triggerGesture)
        .onChange(of: touching) { _, isTouching in
            // A touch the system cancelled (a call, an alert) never reaches onEnded. Let go without firing, so the
            // trigger doesn't stay sunk and the next touch arms the hold again. After a normal release onEnded has
            // already cleared the press, so this does nothing.
            guard !isTouching, triggerPressed else { return }
            pressTask?.cancel()
            pressTask = nil
            triggerPressed = false
            hovered = nil
            if phase == .hovering { phase = .open }
        }
        .zIndex(3)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(isOpen ? "Close menu" : "Open menu")
        .accessibilityHint("Double tap to toggle. Touch and hold, then slide to an action.")
        .accessibilityAction { toggle() }
    }

    /// Tap toggles. Holding 350ms expands and the same touch can slide across items; releasing on one fires it.
    private var triggerGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.space))
            .updating($touching) { _, touching, _ in touching = true }
            .onChanged { value in
                if !triggerPressed {
                    triggerPressed = true
                    longPressed = false
                    if phase == .collapsed {
                        pressTask = Task {
                            try? await Task.sleep(for: .milliseconds(350))
                            guard !Task.isCancelled, triggerPressed else { return }
                            longPressed = true
                            expand()
                        }
                    }
                }
                // While a fired action is on its way home the menu takes no new aim.
                guard isOpen, returning == nil else { return }
                let hit = itemIndex(at: value.location)
                if hit != hovered {
                    hovered = hit
                    if hit != nil { hoverTicks += 1; phase = .hovering } else if phase == .hovering { phase = .open }
                }
                // Set directly, never animated: it eases in only with the lift on the crossing frame.
                if let hit, !reduceMotion { hoverLean = lean(toward: value.location, of: hit) }
            }
            .onEnded { _ in
                pressTask?.cancel()
                pressTask = nil
                triggerPressed = false
                if let hovered, isOpen {
                    fire(hovered)
                } else if !longPressed {
                    toggle()
                } else if phase == .hovering {
                    phase = .open
                }
            }
    }

    @ViewBuilder private var scrim: some View {
        if phase != .collapsed {
            let motion = PieceMotion(reduceMotion: reduceMotion)
            Color.black.opacity(phase == .collapsing ? 0 : style.scrimOpacity)
                .frame(width: 4000, height: 4000)
                .ignoresSafeArea()
                .contentShape(.rect)
                .onTapGesture { collapse() }
                // Once it starts to fade it no longer holds the screen, so taps reach the content underneath.
                .allowsHitTesting(phase != .collapsing)
                // A plain fade that follows the menu: in at the reveal's pace, out at the dismiss's.
                .animation(phase == .collapsing ? motion.dismiss : motion.reveal, value: phase == .collapsing)
                .transition(.opacity)
        }
    }

    // MARK: Geometry

    private func target(_ index: Int) -> CGSize {
        let reach = triggerSize / 2 + spacing + itemSize / 2
        switch arrangement {
        case .linear:
            return CGSize(width: 0, height: -(reach + CGFloat(index) * (itemSize + spacing)))
        case .arc:
            let steps = max(items.count - 1, 1)
            let halfStep = (Double.pi / 2) / Double(steps) / 2
            // Grow the radius until neighbouring actions keep the apart gap.
            let radius = max(reach + 28, (itemSize + spacing) / 2 / sin(halfStep))
            let angle = Double.pi / 2 + (Double.pi / 2) * Double(index) / Double(steps)
            return CGSize(width: cos(angle) * radius, height: -sin(angle) * radius)
        }
    }

    /// An action's home: inside the trigger, shrunk, just short of the trigger's edge on the side facing the action's
    /// place, so it leaves from the side it heads for and melts back in there.
    private func home(_ index: Int) -> CGSize {
        let place = target(index)
        let length = max(hypot(place.width, place.height), 1)
        let inset = max((triggerSize - itemSize * PieceLiquid.homeScale) / 2 - 2, 0)
        return CGSize(width: place.width / length * inset, height: place.height / length * inset)
    }

    /// A few points from the action's center toward the finger, easing off short of 4 like a tether taking the strain.
    private func lean(toward location: CGPoint, of index: Int) -> CGSize {
        let t = target(index)
        let dx = location.x - triggerSize / 2 - t.width, dy = location.y - triggerSize / 2 - t.height
        let distance = hypot(dx, dy)
        guard distance > 0.5 else { return .zero }
        let pull = PieceMotion.rubberBand(distance, limit: 4)
        return CGSize(width: dx / distance * pull, height: dy / distance * pull)
    }

    private func itemIndex(at location: CGPoint) -> Int? {
        let origin = CGPoint(x: triggerSize / 2, y: triggerSize / 2)
        let reach = itemSize / 2 + 8
        return items.indices.first { index in
            let t = target(index)
            return hypot(location.x - origin.x - t.width, location.y - origin.y - t.height) <= reach
        }
    }

    // MARK: Choreography

    private func toggle() { isOpen ? collapse() : expand() }

    /// The actions bud out of the trigger 50ms apart on the split spring, each pulling a neck that thins and snaps as
    /// it reaches its place. Each name buds from its own action 160ms later, once that action is nearly out. The scrim
    /// fades in alongside. Under Reduce Motion everything fades in at its place together.
    private func expand() {
        choreography?.cancel()
        withAnimation(PieceMotion(reduceMotion: reduceMotion).reveal) {
            phase = .expanding
            confirming = false
            returning = nil
        }
        isExpanded?.wrappedValue = true
        let reduceMotion = reduceMotion
        let actions = items.indices.map(Self.action), labels = items.indices.map(Self.name)
        choreography = Task {
            await buds.bloom(actions, reduceMotion: reduceMotion)
            if !reduceMotion { try? await Task.sleep(for: .milliseconds(160)) }
            if Task.isCancelled { return }
            await names.bloom(labels, reduceMotion: reduceMotion)
            if phase == .expanding { phase = .open }
        }
    }

    /// The names melt into their actions first, then the actions melt home on the bounceless home spring, farthest
    /// first, 40ms apart. After a fire the chosen action keeps its swell and melts home last, and the trigger turns to
    /// a check as it arrives.
    private func collapse() {
        choreography?.cancel()
        let motion = PieceMotion(reduceMotion: reduceMotion)
        // Read here, so a collapse that interrupts this one (a scrim tap) still brings the chosen action home last.
        let chosen = returning
        phase = .collapsing
        hovered = nil
        isExpanded?.wrappedValue = false
        let reduceMotion = reduceMotion
        let others = items.indices.filter { $0 != chosen }
        // `gather` calls bubbles home last first, so listing the chosen action first sends it home last.
        let actions = ((chosen.map { [$0] } ?? []) + others).map(Self.action)
        let labels = items.indices.map(Self.name)
        choreography = Task {
            // Not awaited: each gather only returns once its bubbles are removed, long after they set off.
            Task { await names.gather(labels, reduceMotion: reduceMotion) }
            if !reduceMotion { try? await Task.sleep(for: .milliseconds(90)) }
            if Task.isCancelled { return }
            Task { await buds.gather(actions, reduceMotion: reduceMotion) }
            if chosen != nil {
                // The chosen action sets off 40ms behind each of the others and is under the trigger about 220ms
                // later. Under Reduce Motion everything fades out together.
                if !reduceMotion { try? await Task.sleep(for: .milliseconds(40 * others.count + 220)) }
                if Task.isCancelled { return }
                withAnimation(motion.success) {
                    returning = nil
                    if style.confirmsAction { confirming = true }
                }
            }
            withAnimation(motion.dismiss) { phase = .collapsed }
            guard confirming else { return }
            try? await Task.sleep(for: .milliseconds(900))
            if Task.isCancelled { return }
            confirming = false
        }
    }

    /// The rigid haptic lands on release and the action runs 140ms later, as the menu starts to close.
    private func fire(_ index: Int) {
        // One fire at a time, and never from an action that is already leaving.
        guard isOpen, returning == nil else { return }
        hovered = index
        returning = index
        phase = .firing
        fireTicks += 1
        Task {
            try? await Task.sleep(for: .milliseconds(140))
            items[index].action()
            collapse()
        }
    }
}

// MARK: - Example

/// The component alone: the trigger in the corner of the stage, the arc budding out into empty ground.
private struct GlassActionMenuExample: View {
    @State private var expanded = false

    var body: some View {
        GlassActionMenu(items: [
            .init(symbol: "square.and.pencil", label: "Note") {},
            .init(symbol: "mic.fill", label: "Voice memo") {},
            .init(symbol: "camera.fill", label: "Photo") {},
        ], arrangement: .arc, isExpanded: $expanded)
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        .background(GlassActionMenuPalette.ground)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.2))
                expanded = true
                try? await Task.sleep(for: .seconds(2.8))
                expanded = false
            }
        }
    }
}

private enum GlassActionMenuPalette {
    static let ground = Color(UIColor { @Sendable traits in traits.userInterfaceStyle == .dark
        ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1)
        : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) })
}

#Preview("Light") {
    GlassActionMenuExample()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    GlassActionMenuExample()
        .preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, follow, rubberBand, pressMath)

/// The SwiftPieces motion language: five spring tiers, and a named role for every moment a piece moves,
/// each with its Reduce Motion substitute.
///
/// Build one from the environment, `PieceMotion(reduceMotion: reduceMotion)`, and pick the role that names
/// what just happened. Never animate the tracking of a finger: set gesture state directly in `onChanged`, so the
/// surface stays under the finger, and spring only the release.
private struct PieceMotion {
    var reduceMotion = false

    // Tiers. Overshoot and settle times are measured from rest with SwiftUI's Spring.
    /// No overshoot, 90% in about 90ms. A press arriving under the finger.
    static var tight: Spring { Spring(duration: 0.14, bounce: 0) }
    /// About 2.8% overshoot, 90% in about 140ms. Snapping to a detent, page or segment.
    static var responsive: Spring { Spring(duration: 0.32, bounce: 0.25) }
    /// About 8.4% overshoot. Visible give: a release, a return from past an edge, a drag settling home.
    static var elastic: Spring { Spring(duration: 0.42, bounce: 0.38) }
    /// About 15% overshoot. A resolved action landing. At most once per interaction.
    static var expressive: Spring { Spring(duration: 0.48, bounce: 0.48) }
    /// About 1.5% overshoot, unhurried. Opening large surfaces and ambient change.
    static var calm: Spring { Spring(duration: 0.5, bounce: 0.2) }

    /// Reduce Motion: settles become this short spring with no overshoot.
    private static var still: Animation { .spring(duration: 0.25, bounce: 0) }

    // Roles.
    /// Touch-down. Starts on the same frame and never bounces under the finger.
    var press: Animation { .spring(Self.tight) }
    /// The finger lifts off a pressed surface, which springs back through rest.
    var release: Animation { reduceMotion ? Self.still : .spring(Self.elastic) }
    /// A dragged thing comes to rest. With a gesture's velocity, use `settle(velocity:from:to:)` instead.
    var settle: Animation { reduceMotion ? Self.still : .spring(Self.elastic) }
    /// Lands on a detent, page or segment.
    var snap: Animation { reduceMotion ? Self.still : .spring(Self.responsive) }
    /// A number, a chart value or anything else people read moves to its new value. Never overshoots, so it
    /// never shows a value that isn't true.
    var value: Animation { reduceMotion ? Self.still : .spring(duration: 0.35, bounce: 0) }
    /// Comes back from past a limit: a pull beyond the edge, a value pushed against its bound.
    var rebound: Animation { reduceMotion ? Self.still : .spring(Self.elastic) }
    /// A shape or container changes size, corner radius or form, with a little give at the end.
    var morph: Animation { reduceMotion ? Self.still : .spring(duration: 0.4, bounce: 0.2) }
    /// Something appears, opens or expands. Opening is a little slower than closing.
    var reveal: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(Self.calm) }
    /// Something leaves, closes or collapses. Quick and firm, out of the way.
    var dismiss: Animation { reduceMotion ? .easeIn(duration: 0.18) : .spring(duration: 0.3, bounce: 0.08) }
    /// A resolved action lands: a check, a sent state, a reaction.
    var success: Animation { reduceMotion ? .easeOut(duration: 0.24) : .spring(Self.expressive) }
    /// A refused action. Firm, no wobble; `pieceShake` adds the movement.
    var error: Animation { reduceMotion ? .easeOut(duration: 0.2) : .spring(Self.responsive) }
    /// Slow ambient change. Loops themselves stop under Reduce Motion: check `allowsAmbient`.
    var ambient: Animation { reduceMotion ? .easeInOut(duration: 0.3) : .spring(Self.calm) }

    /// Loops, drifts, idle breathing and parallax run only when this is true.
    var allowsAmbient: Bool { !reduceMotion }

    /// A moving transition, or a plain fade under Reduce Motion.
    func transition(_ transition: AnyTransition) -> AnyTransition {
        reduceMotion ? .opacity : transition
    }

    /// For content replaced inside a container that stays put (a label, a glyph, a count): the old content
    /// blurs out as the new one sharpens in. A fade under Reduce Motion.
    @MainActor var swap: AnyTransition {
        reduceMotion ? .opacity : AnyTransition(.blurReplace)
    }
}

extension PieceMotion {
    /// Follow-through: rank 0 leads, each later rank arrives a beat later on a slightly looser spring. Safe to reverse.
    func follow(_ spring: Spring = PieceMotion.elastic, rank: Int) -> Animation {
        guard !reduceMotion else { return .spring(duration: 0.25, bounce: 0) }
        let k = Double(min(max(rank, 0), 6))
        return .spring(duration: spring.duration + 0.04 * k, bounce: min(spring.bounce + 0.02 * k, 0.55))
    }

    /// One-shot entrances only: item `index` waits 30ms per place, capped at the seventh. Exits go together.
    func cascade(_ animation: Animation, index: Int, step: Double = 0.03) -> Animation {
        guard !reduceMotion, index > 0 else { return animation }
        return animation.delay(step * Double(min(index, 7)))
    }
}

extension PieceMotion {
    /// A scroll view's edge resistance for a pull `overshoot` points past a limit; never reaches `limit`.
    /// About 24 to 40 for thumbs and toggles, 60 to 120 for cards and sheets. Band the total pull, not deltas.
    nonisolated static func rubberBand(_ overshoot: CGFloat, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        guard limit > 0, overshoot != 0 else { return 0 }
        let banded = (1 - 1 / (abs(overshoot) * coefficient / limit + 1)) * limit
        return overshoot < 0 ? -banded : banded
    }

    /// `value` inside `range` passes through unchanged; past either end it moves with rubber-band resistance.
    nonisolated static func rubberBand(_ value: CGFloat, in range: ClosedRange<CGFloat>, limit: CGFloat, coefficient: CGFloat = 0.55) -> CGFloat {
        if value < range.lowerBound { return range.lowerBound + rubberBand(value - range.lowerBound, limit: limit, coefficient: coefficient) }
        if value > range.upperBound { return range.upperBound + rubberBand(value - range.upperBound, limit: limit, coefficient: coefficient) }
        return value
    }
}

extension PieceMotion {
    /// About `depth` points per edge, not a fixed percentage: an icon sinks to 0.92, a pill 0.95, a card 0.985.
    nonisolated static func pressScale(for size: CGSize, depth: CGFloat = 2.5) -> CGFloat {
        let side = (max(size.width, 1) * max(size.height, 1)).squareRoot()
        return min(max(1 - depth * 2 / side, 0.92), 0.985)
    }

    /// An anchor partway from the center toward the touch, so the press leans into the finger without tipping.
    nonisolated static func pressAnchor(touch: CGPoint?, in size: CGSize, lean: CGFloat = 0.6) -> UnitPoint {
        guard let touch, size.width > 0, size.height > 0 else { return .center }
        let x = min(max(touch.x / size.width, 0), 1)
        let y = min(max(touch.y / size.height, 0), 1)
        return UnitPoint(x: 0.5 + (x - 0.5) * lean, y: 0.5 + (y - 0.5) * lean)
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress, bud)

/// The liquid glass language: one merge distance, two rest gaps, and the springs a bubble leaves and comes home on.
///
/// Glass shapes inside one `PieceLiquidGroup` melt into each other through a neck when they come within `merge`
/// points. Parts of one control rest `joined`, inside that distance, so the neck holds; separate actions rest
/// `apart`, outside it, so they only goo while one buds out of, or melts back into, another.
private enum PieceLiquid {
    /// Glass shapes closer than this share a neck.
    static let merge: CGFloat = 20
    /// The gap between parts of one control (a stepper's buttons, a progress pill and its stop): the neck holds,
    /// short and smooth, about two thirds of the shapes' height at its waist. Joined parts read best at one height.
    static let joined: CGFloat = 4
    /// The gap between separate actions (menu items, confirm and cancel, chips): they rest as their own bubbles.
    static let apart: CGFloat = 26
    /// How far a bubble shrinks while it is home inside its parent.
    static let homeScale: CGFloat = 0.72

    /// A bubble leaving its parent: slow enough that the neck's stretch and snap read.
    static func split(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.62, bounce: 0.22)
    }

    /// A bubble going home. No bounce: a bounce would carry it out through the far side of its parent.
    static func home(reduceMotion: Bool) -> Animation {
        reduceMotion ? .easeIn(duration: 0.18) : .spring(duration: 0.5, bounce: 0)
    }
}

/// A group of glass shapes that merge into one liquid surface. On iOS 26 it is a `GlassEffectContainer`; before
/// that, and under Reduce Transparency, the shapes draw on their own and simply don't merge. `lift` adds the soft
/// shadow liquid glass floats on in light mode.
private struct PieceLiquidGroup<Content: View>: View {
    var spacing: CGFloat = PieceLiquid.merge
    var lift = true
    @ViewBuilder var content: Content
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        container
            .shadow(color: .black.opacity(lift && colorScheme == .light ? 0.07 : 0), radius: 18, y: 8)
    }

    @ViewBuilder private var container: some View {
        #if compiler(>=6.2)
        if #available(iOS 26, *), !reduceTransparency {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
        #else
        content
        #endif
    }
}

/// One liquid glass shape: Liquid Glass on iOS 26, carrying `tint` as a solid colour and swelling under a press when
/// `interactive`; a frosted Material with a light rim and a soft shadow before that; a solid fill under Reduce
/// Transparency.
///
/// The tint is painted inside clear glass rather than tinting the glass. Tinted glass in a group bleeds its colour
/// through every neck as a smear, so a red button would glow into the white pill it is joined to; painted inside,
/// the colour stays crisp to the shape's edge, the necks between shapes are clear glass, and a tint change animates
/// like any colour (tinted glass snaps).
private struct PieceLiquidSurface<S: Shape>: ViewModifier {
    var shape: S
    var tint: Color?
    var interactive: Bool
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.pieceLiquidScale) private var scale

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26, *), !reduceTransparency {
            // Scaled as two parts, content and outline, about the same centre. A scaleEffect on a glass view inside a
            // GlassEffectContainer shrinks the glass but leaves what it carries full size, pinned to its corner.
            content
                .background { shape.fill(tint ?? .clear) }
                .scaleEffect(scale)
                .glassEffect(glass, in: shape.scale(scale))
        } else {
            fallback(content).scaleEffect(scale)
        }
        #else
        fallback(content).scaleEffect(scale)
        #endif
    }

    #if compiler(>=6.2)
    @available(iOS 26, *)
    private var glass: Glass {
        interactive ? Glass.regular.interactive() : .regular
    }
    #endif

    private func fallback(_ content: Content) -> some View {
        let dark = colorScheme == .dark
        return content
            .background {
                if reduceTransparency {
                    shape.fill(tint ?? (dark ? Color(white: 0.17) : Color(white: 0.97)))
                } else {
                    ZStack {
                        shape.fill(.regularMaterial)
                        if let tint { shape.fill(tint.opacity(0.88)) }
                    }
                }
            }
            .overlay { shape.stroke(Color.white.opacity(dark ? 0.14 : 0.7), lineWidth: 0.5) }
            .shadow(color: .black.opacity(dark ? 0.32 : 0.08), radius: 10, y: 5)
    }
}

private struct PieceLiquidScaleKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1
}

private extension EnvironmentValues {
    /// How much the liquid shapes below are scaled, about their own centres. Nested scales multiply.
    var pieceLiquidScale: CGFloat {
        get { self[PieceLiquidScaleKey.self] }
        set { self[PieceLiquidScaleKey.self] = newValue }
    }
}

private extension View {
    /// Draws this view on a liquid glass `shape`. Put it inside a `PieceLiquidGroup` so it can merge with its neighbours.
    func pieceLiquid<S: Shape>(_ shape: S, tint: Color? = nil, interactive: Bool = true) -> some View {
        modifier(PieceLiquidSurface(shape: shape, tint: tint, interactive: interactive))
    }

    /// Scales the liquid glass shapes in this view, content and outline together, about their own centres. Use it
    /// instead of `scaleEffect` on a glass view (a press, a lift, a swell): inside a group a plain `scaleEffect` shrinks
    /// the glass but leaves its content full size and off centre. Animates like any other value.
    func pieceLiquidScale(_ scale: CGFloat) -> some View {
        transformEnvironment(\.pieceLiquidScale) { $0 *= scale }
    }
}

/// The press for a glass control: the same size-aware sink and lean as `piecePress`, applied through
/// `pieceLiquidScale` so the glass and what it carries sink together (a plain scaleEffect on glass leaves the content
/// behind). Put the glass inside what it presses: the label of a button, the view this modifies. Under Reduce Motion
/// it shades instead of moving.
private struct PieceLiquidPress: ViewModifier {
    let pressed: Bool
    var touch: CGPoint?
    var depth: CGFloat = 2.5
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var size: CGSize = .zero
    @State private var anchor: UnitPoint = .center

    func body(content: Content) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let scale = pressed && !reduceMotion ? PieceMotion.pressScale(for: size, depth: depth) : 1
        // A scale about `anchor` is a scale about the centre plus this shift toward the anchor.
        let lean = CGSize(width: (anchor.x - 0.5) * size.width * (1 - scale), height: (anchor.y - 0.5) * size.height * (1 - scale))
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .pieceLiquidScale(scale)
            .offset(lean)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
            .onChange(of: touch) { _, touch in
                if pressed, let touch { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
    }
}

/// `PiecePressStyle` for glass buttons: the label (with its `.pieceLiquid` inside) sinks as one.
private struct PieceLiquidPressStyle: ButtonStyle {
    var depth: CGFloat = 2.5

    func makeBody(configuration: Configuration) -> some View {
        configuration.label.pieceLiquidPress(configuration.isPressed, depth: depth)
    }
}

private extension View {
    /// Sinks this view's glass while `pressed`, leaning toward `touch` (in this view's coordinates) when given.
    func pieceLiquidPress(_ pressed: Bool, touch: CGPoint? = nil, depth: CGFloat = 2.5) -> some View {
        modifier(PieceLiquidPress(pressed: pressed, touch: touch, depth: depth))
    }
}

/// The bud: how a bubble leaves and rejoins its parent, driven explicitly so every bubble shows the whole cycle.
///
/// A bubble is born at `home`, inside its parent, where the two glass shapes are one. It springs out to `rest`, and
/// while it is inside the merge distance a neck holds it to the parent, thinning as it goes, until it snaps free.
/// Going home it springs back on a spring with no bounce, the neck reaches out and re-forms, and only once it has
/// melted all the way in is it removed. Both offsets are relative to where the bubble is laid out. Under Reduce
/// Motion it stays at `rest`: its content fades and its glass closes in place.
private struct PieceBud: ViewModifier {
    var out: Bool
    var rest: CGSize
    var home: CGSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        if reduceMotion {
            // No travel. Inside a group glass ignores opacity, so the glass closes to nothing in place on the short
            // Reduce Motion ease while its content fades; the opacity covers a bubble outside a group.
            content
                .pieceLiquidScale(out ? 1 : 0.001)
                .opacity(out ? 1 : 0)
                .offset(rest)
        } else {
            // The glass shrinks through `pieceLiquidScale`, never a plain scaleEffect (see there), then moves.
            content
                .pieceLiquidScale(out ? 1 : PieceLiquid.homeScale)
                .offset(out ? rest : home)
        }
    }
}

/// A bubble's own content, on its own clock: gone the moment the bubble heads home, so it never rides over the
/// parent's content, and arriving just after the bubble leaves.
private struct PieceBudContent: ViewModifier {
    var out: Bool

    func body(content: Content) -> some View {
        content
            .blur(radius: out ? 0 : 6)
            .opacity(out ? 1 : 0)
            .animation(out ? .easeOut(duration: 0.3).delay(0.1) : .easeOut(duration: 0.14), value: out)
    }
}

private extension View {
    /// Places a bubble at `rest` while `out`, and at `home` (inside its parent, shrunk) while not.
    func pieceBud(out: Bool, rest: CGSize = .zero, home: CGSize) -> some View {
        modifier(PieceBud(out: out, rest: rest, home: home))
    }

    /// Hides a bubble's icon or label while it is home. Put it on the content, inside the glass.
    func pieceBudContent(out: Bool) -> some View {
        modifier(PieceBudContent(out: out))
    }
}

/// Which bubbles exist and which are out. A bubble is added home with no animation, sent out on the next frame,
/// and called home before it is removed, so it always melts in rather than fading. Keep one in `@State`.
@MainActor @Observable
private final class PieceBuds {
    private(set) var present: [String] = []
    private(set) var out: Set<String> = []
    /// The latest call for each bubble. A bloom or gather that has been overtaken (a bubble sent home while it was
    /// still waiting to go out, or called out again while melting) leaves that bubble alone.
    @ObservationIgnored private var turn: [String: Int] = [:]

    func contains(_ id: String) -> Bool { present.contains(id) }
    func isOut(_ id: String) -> Bool { out.contains(id) }

    private func claim(_ ids: [String]) -> [String: Int] {
        var mine: [String: Int] = [:]
        for id in ids {
            let next = (turn[id] ?? 0) + 1
            turn[id] = next
            mine[id] = next
        }
        return mine
    }

    /// Puts bubbles straight out at rest with no motion: a view's first frame, or a state restored.
    func place(_ ids: [String]) {
        _ = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
            out.formUnion(ids)
        }
    }

    /// Adds bubbles home, then sends each out, `stagger` seconds apart, after an optional `delay`.
    func bloom(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.05, delay: Double = 0) async {
        let mine = claim(ids)
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) {
            for id in ids where !present.contains(id) { present.append(id) }
        }
        try? await Task.sleep(for: .milliseconds(24 + Int(max(delay, 0) * 1000)))
        let split = PieceLiquid.split(reduceMotion: reduceMotion)
        for (i, id) in ids.enumerated() where turn[id] == mine[id] {
            withAnimation(split.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.insert(id) }
        }
    }

    /// Calls bubbles home, last first, then removes them once they have melted in.
    func gather(_ ids: [String], reduceMotion: Bool, stagger: Double = 0.04) async {
        let mine = claim(ids)
        let home = PieceLiquid.home(reduceMotion: reduceMotion)
        for (i, id) in ids.reversed().enumerated() {
            withAnimation(home.delay(reduceMotion ? 0 : Double(i) * stagger)) { _ = out.remove(id) }
        }
        try? await Task.sleep(for: .milliseconds(Int((0.52 + Double(ids.count) * stagger) * 1000)))
        var quiet = Transaction()
        quiet.disablesAnimations = true
        withTransaction(quiet) { present.removeAll { ids.contains($0) && !out.contains($0) && turn[$0] == mine[$0] } }
    }
}

// swiftpieces-liquid: end
