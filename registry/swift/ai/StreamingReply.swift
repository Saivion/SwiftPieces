// swiftpieces:
// title: Streaming Reply
// description: "The AI reply surface in liquid glass. A glass header pill carries the assistant mark and a phase label that morphs letter by letter, text arrives token by token with a per-word fade and a tinted cursor bubble, inline code sits on neutral chips, and user prompts are signal-tinted glass bubbles. A long press lifts the message: the header pill swells into a glass card around the reply and Copy and Regenerate bud out of its bottom edge, and a stopped reply buds a signal Retry out of its header pill."
// category: ai
// minIOSVersion: "17.0"
// version: "2.2.0"
// pro: streaming-markdown
// tags: [chat, streaming, markdown, ai, text-renderer, blocks]

import SwiftUI
import UIKit

/// A chat message that streams. Assistant replies sit on the ground under a glass header pill; user messages are a signal-tinted glass bubble.
///
/// - Parameters:
///   - text: The message body. Append to it as tokens arrive; each new word fades in. Inline markdown is rendered.
///   - role: `.assistant` (leading, header and open text) or `.user` (trailing, tinted glass bubble).
///   - phase: `.thinking` shows dots, `.streaming` shows the cursor, `.done` settles, `.error` shows the message and buds a Retry out of the header pill.
///   - tint: Glass tint of user messages and the streaming cursor. `nil` uses `style.userBlock` and `style.cursor`.
///   - fadeDuration: Seconds each new word takes to fade in.
///   - style: Colors, the assistant name and whether the header shows. Defaults to the house palette.
///   - onAction: Called with `.copy` or `.regenerate` from the long-press actions or the error retry.
public struct StreamingReply: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding private var text: String
    @State private var births: [Double] = []
    @State private var start = Date()
    @State private var fadeGeneration = 0
    @State private var fading = false
    @State private var lifted = false
    /// A long press under way, sinking the message a touch before it lifts.
    @State private var holding = false
    @State private var holdTask: Task<Void, Never>?
    @State private var liftCount = 0
    @State private var actionCount = 0
    @State private var copyCount = 0
    @State private var errorCount = 0
    @State private var copied = false
    /// When the cursor last had reason to hold solid: appearing, or streaming starting with no words yet.
    @State private var cursorFrom: Double = 0
    /// The Copy and Regenerate bubbles under a lifted message, and the Retry bubble beside a stopped reply's header.
    @State private var buds = PieceBuds()
    /// The header pill's frame in the message. The lifted card swells out of it and shrinks back into it.
    @State private var headerFrame: CGRect = .zero
    /// Where each bubble rests, in the message, so it can be born inside what it buds from.
    @State private var restFrames: [String: CGRect] = [:]
    /// The words' size, for where the actions hang.
    @State private var contentSize: CGSize = .zero

    private let role: Role
    private let phase: Phase
    private let tint: Color?
    private let fadeDuration: Double
    private let style: Style
    private let onAction: (Action) -> Void

    public enum Role: Sendable { case user, assistant }
    public enum Phase: Equatable, Sendable { case thinking, streaming, done, error(String) }
    public enum Action: Sendable { case copy, regenerate }

    public init(text: Binding<String>, role: Role = .assistant, phase: Phase = .done, tint: Color? = nil, fadeDuration: Double = 0.35, style: Style = .standard, onAction: @escaping (Action) -> Void = { _ in }) {
        _text = text
        self.role = role
        self.phase = phase
        self.tint = tint
        self.fadeDuration = fadeDuration
        self.style = style
        self.onAction = onAction
    }

    private var isUser: Bool { role == .user }
    private var errorMessage: String? { if case .error(let m) = phase { m } else { nil } }
    private var userBlock: Color { tint ?? style.userBlock }
    private var cursorColor: Color { tint ?? style.cursor }
    private var textColor: Color { isUser ? style.ink : style.text }
    /// A stopped reply with a header buds its Retry out of the header pill; without one, Retry sits under the message.
    private var retriesFromHeader: Bool { !isUser && style.showsHeader }
    /// The card a lifted reply rests on reaches this far past its text. A user's bubble is its own card.
    private var cardInset: CGFloat { isUser ? 0 : 12 }
    /// Height of the Copy and Regenerate bubbles.
    private let actionHeight: CGFloat = 44
    private static let space = "StreamingReply.message"

    public var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        VStack(alignment: isUser ? .trailing : .leading, spacing: 0) {
            content
                .onGeometryChange(for: CGSize.self) { $0.size } action: { contentSize = $0 }
                .onLongPressGesture(minimumDuration: 0.35, perform: lift, onPressingChanged: hold)
                .onTapGesture { if lifted { putDown() } }
                // Every glass shape sits behind the words, in one group, so they melt into each other. The lift's shadow
                // sits behind the glass, cast from its outline.
                .background(alignment: .topLeading) { glass }
                .background(alignment: .topLeading) { liftShadow }
                .coordinateSpace(.named(Self.space))
                // Held, the message sinks a touch toward its tail, then rises off the table. Under Reduce Motion it
                // keeps its size and the card and shadow carry the lift.
                .scaleEffect(reduceMotion ? 1 : lifted ? 1.02 : holding ? 0.985 : 1, anchor: isUser ? .bottomTrailing : .bottomLeading)
                // The message springs up and lands back with a little give.
                .animation(lifted ? motion.release : motion.settle, value: lifted)
            // The room the actions take opens on the calm reveal, with only a slight give, so the host's other
            // messages never bob. The actions themselves bud out of the message into it.
            Color.clear.frame(height: lifted ? cardInset + PieceLiquid.joined + actionHeight : 0)
        }
        .fontWeight(.semibold)
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
        .sensoryFeedback(.impact(flexibility: .rigid), trigger: liftCount)
        .sensoryFeedback(.success, trigger: actionCount)
        .sensoryFeedback(.error, trigger: errorCount)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(isUser ? "You" : style.assistantName): \(text)")
        .accessibilityValue(phaseLabel)
        .accessibilityAction(named: "Copy") { perform(.copy) }
        .accessibilityAction(named: "Regenerate") { perform(.regenerate) }
        .onAppear {
            births = Array(repeating: -1_000, count: Self.tokenRanges(in: attributed).count)
            cursorFrom = Date().timeIntervalSince(start)
            buds.place(wantedBuds)
        }
        .onChange(of: text) { _, new in
            // Only words that arrive after appear animate. Regenerated (shorter) text resets the tail.
            let count = Self.tokenRanges(in: Self.parse(new, chip: codeChip, ink: codeInk)).count
            let now = Date().timeIntervalSince(start)
            if count < births.count { births.removeLast(births.count - count) }
            // Words that arrive together ink in left to right, 24ms apart, never more than 0.12s behind the stream
            // and never ahead of a word before them. Under Reduce Motion they fade in together.
            let first = births.count
            let spread = reduceMotion ? 0 : min(0.12, fadeDuration * 0.4)
            while births.count < count {
                let birth = now + min(Double(births.count - first) * 0.024, spread)
                births.append(max(birth, births.last ?? birth))
            }
            fading = true
            fadeGeneration += 1
        }
        .onChange(of: phase) { old, new in
            if new == .streaming { cursorFrom = Date().timeIntervalSince(start) }
            // One error haptic and one small shake of the mark as a reply stops; a new message while stopped is quiet.
            if !isUser, Self.stopped(new), !Self.stopped(old) { errorCount += 1 }
            syncBuds()
        }
        .onChange(of: lifted) { syncBuds() }
        .task(id: fadeGeneration) {
            // The clock runs until the last word in flight has landed. A newer batch of words takes over.
            let left = (births.last ?? 0) + fadeDuration - Date().timeIntervalSince(start)
            do { try await Task.sleep(for: .seconds(max(left, 0) + 0.1)) } catch { return }
            fading = false
        }
        .task(id: actionCount) {
            guard copied else { return }
            let lift = liftCount
            // Copied shows for a beat, then the message is set down, unless it was put down and picked up again since.
            do { try await Task.sleep(for: .seconds(0.9)) } catch { return }
            if lifted, liftCount == lift { putDown() }
            do { try await Task.sleep(for: .seconds(0.5)) } catch { return }
            withAnimation(PieceMotion(reduceMotion: reduceMotion).morph) { copied = false }
        }
    }

    // MARK: Lift

    /// Touch-down on the message. After a beat, so a touch that turns into a scroll never dents it, the message
    /// starts to sink and deepens through the hold. Letting go early springs it back.
    private func hold(_ down: Bool) {
        holdTask?.cancel()
        guard down, !lifted else {
            // Let go early, or taken over by a scroll: it springs back through rest like any released press.
            if holding { withAnimation(PieceMotion(reduceMotion: reduceMotion).release) { holding = false } }
            return
        }
        holdTask = Task {
            try? await Task.sleep(for: .milliseconds(100))
            guard !Task.isCancelled else { return }
            // Unhurried, so it is still deepening when the lift takes over. No give: a press never bounces under the
            // finger, so this keeps the calm tier's pace without its overshoot.
            withAnimation(.spring(duration: PieceMotion.calm.duration, bounce: 0)) { holding = true }
            // A hold resolves by 0.35s, as a lift or a cancel. If neither reports back, let go anyway.
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            withAnimation(PieceMotion(reduceMotion: reduceMotion).snap) { holding = false }
        }
    }

    /// The hold completes: the message springs up out of its sink, with a rigid tap, the header pill swells into a
    /// card around it and the actions bud out of the card. The room the actions take opens calmly; the message's
    /// spring is scoped to it in `body`, the card and the actions carry their own.
    private func lift() {
        holdTask?.cancel()
        withAnimation(PieceMotion(reduceMotion: reduceMotion).reveal) {
            holding = false
            lifted = true
        }
        liftCount += 1
    }

    /// Set down: the message lands with a little give (scoped in `body`) as the actions melt back and the card
    /// shrinks into the header pill, both with no bounce.
    private func putDown() {
        withAnimation(PieceMotion(reduceMotion: reduceMotion).dismiss) { lifted = false }
    }

    // MARK: Buds

    /// The bubbles that should be out now: Copy and Regenerate under a lifted message, Retry beside a stopped reply's
    /// header while it rests (lifted, the card would swallow it).
    private var wantedBuds: [String] {
        var ids: [String] = []
        if retriesFromHeader, errorMessage != nil, !lifted { ids.append("retry") }
        if lifted { ids += isUser ? ["copy"] : ["copy", "regenerate"] }
        return ids
    }

    /// Sends out what should be out and calls home what should not, each on its own clock, so a lift never waits for
    /// Retry to melt.
    private func syncBuds() {
        let wanted = wantedBuds
        let leaving = buds.present.filter { !wanted.contains($0) }
        let arriving = wanted.filter { !buds.isOut($0) }
        if !leaving.isEmpty { Task { await buds.gather(leaving, reduceMotion: reduceMotion) } }
        if !arriving.isEmpty { Task { await buds.bloom(arriving, reduceMotion: reduceMotion) } }
    }

    /// Where a bubble is born and melts back to, from where it rests. The actions of a reply with a header grow out of
    /// the header pill with the card and shrink back into it with the card, so they are always inside glass while
    /// home. Otherwise a bubble's home is just inside the nearest edge of what it hangs from.
    /// Worked out from what is known before a bubble is first laid out (its first frame is already home, and glass in
    /// a group can't be hidden while it waits), then from its measured place: a fair width until then.
    private func home(_ id: String) -> CGSize {
        if id == "retry" {
            let width = restFrames[id]?.width ?? 88
            return CGSize(width: -(width / 2 + PieceLiquid.joined + width * PieceLiquid.homeScale / 2), height: 0)
        }
        if !isUser, style.showsHeader, headerFrame != .zero {
            let restY = contentSize.height + cardInset + PieceLiquid.joined + actionHeight / 2
            let restX = restFrames[id]?.midX ?? (id == "copy" ? 50 : 100 + PieceLiquid.apart + 70)
            return CGSize(width: headerFrame.midX - restX, height: headerFrame.midY - restY)
        }
        return CGSize(width: 0, height: -(actionHeight / 2 + PieceLiquid.joined + actionHeight * PieceLiquid.homeScale / 2))
    }

    // MARK: Surface

    /// The words: the header's mark and labels, the dots or the text, and the error message. The glass they sit on is
    /// drawn behind them, in `glass`.
    @ViewBuilder
    private var content: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        if isUser {
            streamedText
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Self.userShape)
                .padding(.leading, 48)
        } else {
            VStack(alignment: .leading, spacing: 10) {
                if style.showsHeader { header }
                if phase == .thinking { ThinkingDots(reduceMotion: reduceMotion, colors: style.dots) }
                // Streaming keeps the line the dots held, with the cursor alone, until the first words arrive, so the
                // reply never collapses and regrows.
                if !text.isEmpty || phase == .streaming { streamedText }
                if let errorMessage { errorRow(errorMessage) }
            }
            // New phases come in calmly; settling to done clears the label and cursor firmly.
            .animation(phase == .done ? motion.dismiss : motion.reveal, value: phase)
            .padding(.vertical, 4)
            .padding(.trailing, 24)
        }
    }

    private static let userShape = UnevenRoundedRectangle(topLeadingRadius: 22, bottomLeadingRadius: 22, bottomTrailingRadius: 6, topTrailingRadius: 22, style: .continuous)

    /// Every glass shape of the message, in one group: the header pill that swells into the lifted card (or the
    /// user's tinted bubble), Retry under its end, and the actions under everything. Later backgrounds sit further
    /// back, so a bubble at home is always under what it melts into.
    private var glass: some View {
        PieceLiquidGroup {
            Color.clear
                .background(alignment: .topLeading) { surfaceGlass }
                .background(alignment: .topLeading) { retryBubble }
                .background(alignment: isUser ? .bottomTrailing : .bottomLeading) { actionBubbles }
        }
        // A reply without a header has no glass at rest, so its card rises in with the whole group on the lift's
        // reveal and leaves on its dismiss. Glass inside a group can't fade on its own.
        .opacity(isUser || style.showsHeader || lifted ? 1 : 0)
        .animation(lifted ? PieceMotion(reduceMotion: reduceMotion).reveal : PieceMotion(reduceMotion: reduceMotion).dismiss, value: lifted)
    }

    /// The glass under the words. A user's message is a bubble tinted with its block colour. An assistant's reply
    /// rests on the header pill; lifted, that same shape swells into a card around the whole reply, on the split
    /// spring, and shrinks back into the pill with no bounce. A reply without a header has no pill to grow from, so
    /// its card rises in on its own.
    @ViewBuilder
    private var surfaceGlass: some View {
        GeometryReader { proxy in
            if isUser {
                Color.clear
                    .pieceLiquid(Self.userShape, tint: userBlock, interactive: false)
                    .padding(.leading, 48)
            } else {
                let rect = surfaceRect(in: proxy.size)
                Color.clear
                    .frame(width: max(rect.width, 0), height: max(rect.height, 0))
                    .pieceLiquid(RoundedRectangle(cornerRadius: surfaceRadius, style: .continuous), interactive: false)
                    .offset(x: rect.minX, y: rect.minY)
                    .animation(surfaceMotion, value: lifted)
            }
        }
    }

    /// The lift's shadow, under the same outline as the glass and on the same spring. A shadow on the glass itself
    /// would ring it with a dark halo.
    @ViewBuilder
    private var liftShadow: some View {
        GeometryReader { proxy in
            if isUser {
                OutlineShadow(shape: Self.userShape, lifted: lifted)
                    .padding(.leading, 48)
                    .animation(PieceMotion(reduceMotion: reduceMotion).reveal, value: lifted)
            } else {
                let rect = surfaceRect(in: proxy.size)
                OutlineShadow(shape: RoundedRectangle(cornerRadius: surfaceRadius, style: .continuous), lifted: lifted)
                    .frame(width: max(rect.width, 0), height: max(rect.height, 0))
                    .offset(x: rect.minX, y: rect.minY)
                    .animation(surfaceMotion, value: lifted)
            }
        }
    }

    /// Where an assistant reply's glass is: the header pill at rest, the card around the reply while lifted.
    private func surfaceRect(in size: CGSize) -> CGRect {
        style.showsHeader && !lifted ? headerFrame : CGRect(origin: .zero, size: size).insetBy(dx: -cardInset, dy: -cardInset)
    }

    private var surfaceRadius: CGFloat { style.showsHeader && !lifted ? headerFrame.height / 2 : 18 }

    /// Out on the split spring, home with no bounce, as a bud.
    private var surfaceMotion: Animation {
        lifted ? PieceLiquid.split(reduceMotion: reduceMotion) : PieceLiquid.home(reduceMotion: reduceMotion)
    }

    /// Mark, name and a live phase label: the words on the header pill. The pill itself is `surfaceGlass`, which
    /// follows this frame, reshaping with a little give as the label morphs.
    private var header: some View {
        let space = Self.space
        return HStack(spacing: 0) {
            Image(systemName: "sparkle")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(style.markInk)
                .frame(width: 24, height: 24)
                .background(errorMessage == nil ? style.mark : style.signal, in: Circle())
                .symbolEffect(.pulse, options: .repeating, isActive: phase == .thinking && PieceMotion(reduceMotion: reduceMotion).allowsAmbient)
                // A reply that stops shakes its head once, small. Under Reduce Motion the signal color says it.
                .pieceShake(trigger: errorCount, distance: 3)
            Text(style.assistantName)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(style.text)
                .padding(.leading, 8)
            // THINKING becomes WRITING letter by letter, the letters they share holding still, and clears when done.
            PieceMorphText(text: phaseLabel.uppercased(), font: .caption2.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(style.muted)
                .padding(.leading, phaseLabel.isEmpty ? 0 : 8)
        }
        .padding(.leading, 4)
        .padding(.trailing, 12)
        .frame(minHeight: 32)
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(space)) } action: { frame in
            // Placed on the first layout, then reshaped with the label on the morph spring. Narrowing waits a beat,
            // so the letters leaving blur away inside the glass rather than past its end.
            if headerFrame == .zero {
                headerFrame = frame
            } else {
                let morph = PieceMotion(reduceMotion: reduceMotion).morph
                withAnimation(frame.width < headerFrame.width && !reduceMotion ? morph.delay(0.15) : morph) { headerFrame = frame }
            }
        }
        .accessibilityHidden(true)
    }

    private var phaseLabel: String {
        switch phase {
        case .thinking: "Thinking"
        case .streaming: "Writing"
        case .done: ""
        case .error: "Stopped"
        }
    }

    @ViewBuilder
    private var streamedText: some View {
        let showsCursor = phase == .streaming && !isUser
        // The clock runs only while words are inking in or the cursor breathes.
        TimelineView(.animation(paused: !(fading || (showsCursor && cursorBreathes)))) { context in
            let now = context.date.timeIntervalSince(start)
            if #available(iOS 18, *) {
                rendererText(showsCursor: showsCursor)
                    .textRenderer(TokenFade(now: now, births: births, fade: fadeDuration, rise: reduceMotion ? 0 : 2, cursorOpacity: cursorOpacity(at: now), chip: codeChip))
            } else {
                fallbackText(now: now, showsCursor: showsCursor)
            }
        }
        // A phase change never animates the text itself. Under the phase spring a changed Text keeps drawing its old
        // run while the clock ticks, so the cursor, and words that land with .done, would trail the label by ~0.4s.
        .animation(nil, value: phase)
        .font(.body)
        .lineSpacing(3)
        .foregroundStyle(textColor)
        .tint(textColor)
        // No text selection: selectable text is drawn without the renderer, so words would land without their ink
        // and the cursor would never breathe. Copy in the lifted actions takes the whole message.
        .fixedSize(horizontal: false, vertical: true)
    }

    /// Each word is its own run, so the renderer can ink it in on its own clock. Inline code is marked rather than
    /// filled, so the renderer can draw one rounded chip under a span of code even while its words arrive one by one.
    /// Both ride one attribute on each piece of a word: an attribute on the whole word would replace the piece's.
    @available(iOS 18, *)
    private func rendererText(showsCursor: Bool) -> Text {
        let source = attributed
        var result = Text(verbatim: "")
        for (index, range) in Self.tokenRanges(in: source).enumerated() {
            for run in source[range].runs {
                var piece = AttributedString(source[run.range])
                let isCode = run.inlinePresentationIntent?.contains(.code) == true
                if isCode { piece.backgroundColor = nil }
                result = Text("\(result)\(Text(piece).customAttribute(TokenIndex(index: index, isCode: isCode)))")
            }
        }
        if showsCursor { result = Text("\(result)\(cursor.customAttribute(CursorMark()))") }
        return result
    }

    private func fallbackText(now: Double, showsCursor: Bool) -> Text {
        var source = attributed
        for (index, range) in Self.tokenRanges(in: source).enumerated() {
            let opacity = Ink.opacity(Ink.progress(now: now, birth: births.indices.contains(index) ? births[index] : -1_000, fade: fadeDuration))
            let onTint = codeInk != nil && source[range].backgroundColor != nil
            source[range].foregroundColor = (onTint ? style.ink : textColor).opacity(opacity)
        }
        return showsCursor ? Text("\(Text(source))\(cursor)") : Text(source)
    }

    /// The cursor breathes through the iOS 18 renderer. On iOS 17 and under Reduce Motion it holds solid.
    private var cursorBreathes: Bool {
        guard PieceMotion(reduceMotion: reduceMotion).allowsAmbient else { return false }
        if #available(iOS 18, *) { return true }
        return false
    }

    /// Solid while words land, like a caret while typing. Once the stream goes quiet it breathes slowly between
    /// full and 55%, starting from full so it never jumps.
    private func cursorOpacity(at now: Double) -> Double {
        guard cursorBreathes else { return 1 }
        let quiet = now - max((births.last ?? -1_000) + fadeDuration, cursorFrom) - 0.4
        guard quiet > 0 else { return 1 }
        return 0.775 + 0.225 * cos(quiet * 2 * .pi / 1.2)
    }

    /// A small tinted bubble the height of the body font's cap height, drawn inline so it flows with the text.
    private var cursor: Text {
        let font = UIFont.preferredFont(forTextStyle: .body)
        let size = CGSize(width: font.capHeight * 0.6, height: font.capHeight * 1.1)
        let image = UIGraphicsImageRenderer(size: CGSize(width: size.width + 4, height: size.height)).image { _ in
            UIBezierPath(roundedRect: CGRect(x: 4, y: 0, width: size.width, height: size.height), cornerRadius: size.width / 2).fill()
        }
        return Text(Image(uiImage: image.withRenderingMode(.alwaysTemplate))).foregroundStyle(cursorColor)
    }

    /// Copy and Regenerate, separate actions resting apart, hanging a neck's width under the card or bubble they bud
    /// out of, so the neck holds them to it.
    private var actionBubbles: some View {
        let drop = cardInset + PieceLiquid.joined
        return HStack(spacing: PieceLiquid.apart) {
            if buds.contains("copy") { actionBubble(.copy) }
            if !isUser, buds.contains("regenerate") { actionBubble(.regenerate) }
        }
        .alignmentGuide(.bottom) { $0[.top] - drop }
    }

    private func actionBubble(_ action: Action) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let id = action == .copy ? "copy" : "regenerate"
        let out = buds.isOut(id)
        // Copied is a success: the glass tints sage, the glyph swaps to a check and the label morphs.
        let done = action == .copy && copied
        let title = action == .regenerate ? "Regenerate" : copied ? "Copied" : "Copy"
        let symbol = action == .regenerate ? "arrow.clockwise" : copied ? "checkmark" : "doc.on.doc"
        let space = Self.space
        return Button { perform(action) } label: {
            HStack(spacing: 6) {
                ZStack {
                    Image(systemName: symbol)
                        .id(symbol)
                        .transition(motion.swap)
                }
                PieceMorphText(text: title, font: .subheadline.weight(.semibold))
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(done ? style.ink : style.actionInk)
            .pieceBudContent(out: out)
            .padding(.horizontal, 14)
            .frame(height: actionHeight)
            // The tint drains as it melts home, so it never sits on the words.
            .pieceLiquid(Capsule(), tint: out && done ? style.success : nil, interactive: false)
            .contentShape(Capsule())
        }
        .buttonStyle(PieceLiquidPressStyle())
        // Copied lands with a small pop on the success haptic.
        .pieceLiquidPop(trigger: action == .copy ? copyCount : 0, amount: 0.06)
        .pieceBud(out: out, home: home(id))
        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(space)) } action: { restFrames[id] = $0 }
    }

    /// Retry, budding out of the end of a stopped reply's header pill and joined to it by a neck. A signal tint: the
    /// one action that matters now. Its glass is the pill's height; its target is 44pt tall.
    @ViewBuilder
    private var retryBubble: some View {
        if buds.contains("retry") {
            let out = buds.isOut("retry")
            let space = Self.space
            Button { perform(.regenerate) } label: {
                Label("Retry", systemImage: "arrow.clockwise")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(style.ink)
                    .pieceBudContent(out: out)
                    .padding(.horizontal, 12)
                    .frame(height: max(headerFrame.height, 32))
                    .pieceLiquid(Capsule(), tint: out ? style.signal : nil, interactive: false)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(PieceLiquidPressStyle())
            .fixedSize()
            .pieceBud(out: out, home: home("retry"))
            .offset(x: headerFrame.maxX + PieceLiquid.joined, y: headerFrame.midY - 22)
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(space)) } action: { restFrames["retry"] = $0 }
        }
    }

    /// The stopped reply's message. Without a header there is no pill to bud from, so Retry sits beside it on its
    /// own glass, arriving with the row.
    private func errorRow(_ message: String) -> some View {
        HStack(spacing: 10) {
            Text(message)
                .font(.subheadline)
                .foregroundStyle(style.muted)
                .fixedSize(horizontal: false, vertical: true)
            if !retriesFromHeader {
                Spacer(minLength: 8)
                PieceLiquidGroup {
                    Button { perform(.regenerate) } label: {
                        Label("Retry", systemImage: "arrow.clockwise")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(style.ink)
                            .padding(.horizontal, 14)
                            .frame(minHeight: 44)
                            .pieceLiquid(Capsule(), tint: style.signal, interactive: false)
                    }
                    .buttonStyle(PieceLiquidPressStyle())
                }
            }
        }
        .transition(.opacity)
    }

    private func perform(_ action: Action) {
        if action == .copy {
            UIPasteboard.general.string = text
            // The bubble widens to fit Copied as the glyph turns into a check and the glass tints sage. The message
            // is set down after a beat.
            withAnimation(PieceMotion(reduceMotion: reduceMotion).morph) { copied = true }
            copyCount += 1
        } else {
            putDown()
        }
        actionCount += 1
        onAction(action)
    }

    private static func stopped(_ phase: Phase) -> Bool {
        if case .error = phase { true } else { false }
    }

    // MARK: Tokens

    /// The chip under inline `code`: the text colour, faint, so it reads on the ground and on a tinted bubble alike,
    /// or `style.code` when an app tints it.
    private var codeChip: Color { style.code == .clear ? textColor.opacity(0.1) : style.code }
    /// Dark ink on a tinted chip; a neutral chip keeps the text colour.
    private var codeInk: Color? { style.code == .clear ? nil : style.ink }

    private var attributed: AttributedString { Self.parse(text, chip: codeChip, ink: codeInk) }

    /// How far a code chip reaches past its first letter, and the room kerned open for it at each end.
    private static let chipPad: CGFloat = 3

    private static func parse(_ text: String, chip: Color, ink: Color?) -> AttributedString {
        var result = (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text)
        for run in result.runs {
            guard var intent = run.inlinePresentationIntent else { continue }
            // One weight: strong emphasis keeps the body's semibold rather than turning bold.
            if intent.contains(.stronglyEmphasized) {
                intent.remove(.stronglyEmphasized)
                result[run.range].inlinePresentationIntent = intent
            }
            // Inline code sits on a small chip. On iOS 18 the renderer draws it rounded; on iOS 17 it is the run's
            // background.
            if intent.contains(.code) {
                result[run.range].backgroundColor = chip
                if let ink { result[run.range].foregroundColor = ink }
            }
        }
        // Room for the chip: its last letter and the space before it are kerned open, so the chip's ends never
        // crowd the words around it.
        for run in result.runs where run.inlinePresentationIntent?.contains(.code) == true {
            let last = result.characters.index(before: run.range.upperBound)
            result[last..<run.range.upperBound].kern = Self.chipPad
            if run.range.lowerBound > result.startIndex {
                let before = result.characters.index(before: run.range.lowerBound)
                result[before..<run.range.lowerBound].kern = Self.chipPad
            }
        }
        return result
    }

    /// Splits into word tokens; each token carries its trailing whitespace so runs stay contiguous.
    private static func tokenRanges(in source: AttributedString) -> [Range<AttributedString.Index>] {
        let chars = source.characters
        var ranges: [Range<AttributedString.Index>] = []
        var start = chars.startIndex
        var previousWasSpace = false
        var index = chars.startIndex
        while index < chars.endIndex {
            let isSpace = chars[index].isWhitespace
            if !isSpace, previousWasSpace, index > start { ranges.append(start..<index); start = index }
            previousWasSpace = isSpace
            index = chars.index(after: index)
        }
        if start < chars.endIndex { ranges.append(start..<chars.endIndex) }
        return ranges
    }
}

public extension StreamingReply {
    /// Look of a `StreamingReply`. Start from `.standard` and change what you need.
    struct Style: Sendable {
        /// Glass tint of user messages, unless `tint` is passed.
        public var userBlock: Color = Color(red: 1, green: 0, blue: 0)
        /// The streaming cursor, unless `tint` is passed.
        public var cursor: Color = Color(red: 1, green: 0, blue: 0)
        /// The chip behind inline `code`. `.clear`, the default, leaves it a faint neutral chip in the text colour;
        /// any other colour tints it, with dark ink on top.
        public var code: Color = .clear
        /// The three thinking dots, in order.
        public var dots: [Color] = [Color(red: 1, green: 0, blue: 0), Color(red: 0.612, green: 0.761, blue: 1), Color(red: 0.804, green: 0.722, blue: 1)]
        /// Retry's tint and the mark in the error phase.
        public var signal: Color = Color(red: 1, green: 0, blue: 0)
        /// Dark ink used on every tint.
        public var ink: Color = Color(red: 0.078, green: 0.078, blue: 0.078)
        /// Assistant text and name.
        public var text: Color = Style.adaptive(0x141414, 0xF4F3EF)
        /// Phase label and error message.
        public var muted: Color = Style.adaptive(0x5C5A56, 0xA6A49F)
        /// Unused since the liquid glass refactor: a lifted reply rests on the glass its header pill swells into.
        /// Kept so existing code still compiles.
        public var surface: Color = Style.adaptive(0xFFFFFF, 0x1C1C1C)
        /// The assistant mark's disc and its glyph.
        public var mark: Color = Style.adaptive(0x141414, 0xF4F3EF)
        public var markInk: Color = Style.adaptive(0xF3F2EE, 0x121212)
        /// Unused since the liquid glass refactor: Copy and Regenerate are neutral glass. Kept so existing code still
        /// compiles.
        public var actionFill: Color = Style.adaptive(0x141414, 0xF4F3EF)
        /// Labels and glyphs on Copy and Regenerate.
        public var actionInk: Color = Style.adaptive(0x141414, 0xF4F3EF)
        /// Copy's tint once it has copied.
        public var success: Color = Color(red: 0.663, green: 0.863, blue: 0.718)
        /// Name shown in the header and read by VoiceOver.
        public var assistantName: String = "Assistant"
        /// Show the mark, name and phase label above assistant replies.
        public var showsHeader: Bool = true

        public init() {}

        /// The house palette: signal prompts and cursor, neutral glass actions and code chips.
        public static let standard = Style()

        private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
            Color(UIColor { @Sendable traits in
                let hex = traits.userInterfaceStyle == .dark ? dark : light
                return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
            })
        }
    }
}

/// Which word a run belongs to, and whether it is inline code, whose chip the renderer draws.
@available(iOS 18, *)
private struct TokenIndex: TextAttribute {
    let index: Int
    var isCode = false
}

@available(iOS 18, *)
private struct CursorMark: TextAttribute {}

/// How a word's ink settles. Its opacity runs on a cubic ease-out, so it reads almost at once and slows into full
/// strength; its small rise runs on a softer ease-out that trails, so the word comes to rest just after it is inked.
private enum Ink {
    nonisolated static func progress(now: Double, birth: Double, fade: Double) -> Double {
        guard fade > 0 else { return now >= birth ? 1 : 0 }
        return min(max((now - birth) / fade, 0), 1)
    }

    nonisolated static func opacity(_ progress: Double) -> Double { 1 - pow(1 - progress, 3) }

    /// The share of the rise still to go.
    nonisolated static func drop(_ progress: Double) -> Double { (1 - progress) * (1 - progress) }
}

/// Draws each word run as its ink settles, rising `rise` points into place, puts inline code on rounded chips, and
/// breathes the cursor run.
@available(iOS 18, *)
private struct TokenFade: TextRenderer {
    var now: Double
    var births: [Double]
    var fade: Double
    var rise: Double
    var cursorOpacity: Double
    var chip: Color

    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
        for line in layout {
            let runs = Array(line)
            // Chips first, under their words. Neighbouring runs of code share one chip, rounded only at its ends, so
            // a span whose words arrive one by one still reads as one chip; each piece inks in with its word.
            let code = runs.map { $0[TokenIndex.self]?.isCode == true }
            for (i, run) in runs.enumerated() where code[i] {
                let opens = i == 0 || !code[i - 1]
                let closes = i == runs.count - 1 || !code[i + 1]
                // The run already carries the room kerned after its last letter; the chip reaches back into the room
                // kerned before its first.
                var rect = run.typographicBounds.rect
                if opens { rect.origin.x -= 3; rect.size.width += 3 }
                let corner: CGFloat = 5
                let shape = UnevenRoundedRectangle(topLeadingRadius: opens ? corner : 0, bottomLeadingRadius: opens ? corner : 0, bottomTrailingRadius: closes ? corner : 0, topTrailingRadius: closes ? corner : 0, style: .continuous)
                var local = context
                ink(run, in: &local)
                local.fill(shape.path(in: rect), with: .color(chip))
            }
            for run in runs {
                var local = context
                ink(run, in: &local)
                local.draw(run)
            }
        }
    }

    private func ink(_ run: Text.Layout.Run, in context: inout GraphicsContext) {
        if run[CursorMark.self] != nil {
            // The cursor jumps with the text, so it only breathes and never drifts.
            context.opacity = cursorOpacity
        } else if let token = run[TokenIndex.self], births.indices.contains(token.index) {
            let progress = Ink.progress(now: now, birth: births[token.index], fade: fade)
            context.opacity = Ink.opacity(progress)
            context.translateBy(x: 0, y: Ink.drop(progress) * rise)
        }
    }
}

/// A lifted surface's shadow, cast from its outline rather than its glass: the shape filled and shadowed, then cut
/// away inside the outline, so only the shadow around it shows and nothing sits under the glass.
private struct OutlineShadow<S: Shape>: View {
    let shape: S
    let lifted: Bool

    var body: some View {
        shape
            .fill(.black)
            .shadow(color: .black.opacity(lifted ? 0.18 : 0), radius: lifted ? 22 : 0, y: lifted ? 10 : 0)
            .mask { Outside(shape: shape).fill(style: FillStyle(eoFill: true)) }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// Everything around a shape, far enough out to hold its shadow.
private struct Outside<S: Shape>: Shape {
    let shape: S

    nonisolated func path(in rect: CGRect) -> Path {
        var path = Path(rect.insetBy(dx: -60, dy: -60))
        path.addPath(shape.path(in: rect))
        return path
    }
}

/// Three block-colored dots rising in sequence, sized to sit where the first line of text will be. Each rise eases
/// out of rest and back into it, and the first dot starts from rest when the dots appear. Under Reduce Motion the
/// dots stay put and the same ripple runs through their opacity, so thinking still shows a sign of life.
private struct ThinkingDots: View {
    let reduceMotion: Bool
    let colors: [Color]
    @State private var appeared: Date?

    var body: some View {
        TimelineView(.animation) { context in
            let t = appeared.map { context.date.timeIntervalSince($0) } ?? 0
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { index in
                    let phase = ((t * 0.9 - Double(index) * 0.16).truncatingRemainder(dividingBy: 1) + 1).truncatingRemainder(dividingBy: 1)
                    let wave = phase < 0.45 ? sin(phase / 0.45 * .pi) : 0
                    let lift = wave * wave
                    Circle()
                        .fill(colors.isEmpty ? Color.secondary : colors[index % colors.count])
                        .frame(width: 9, height: 9)
                        .opacity(reduceMotion ? 0.5 + 0.5 * lift : 1)
                        .scaleEffect(reduceMotion ? 0.8 : 0.8 + 0.2 * lift)
                        .offset(y: reduceMotion ? 0 : -5 * lift)
                }
            }
        }
        .frame(height: UIFont.preferredFont(forTextStyle: .body).lineHeight)
        .onAppear { appeared = .now }
        .transition(.opacity)
        .accessibilityHidden(true)
    }
}

// MARK: - Example

/// A prompt block, then a reply that thinks, streams and settles.
private struct StreamingReplyExample: View {
    @State private var reply = ""
    @State private var prompt = "Summarize the **Q3 report** in two lines."
    @State private var phase: StreamingReply.Phase = .thinking
    @State private var run = 0
    private let full = "Revenue grew **12%** quarter over quarter and churn fell to 1.8%. The new `Insights` tab drove most of the engagement lift."

    var body: some View {
        VStack(spacing: 24) {
            StreamingReply(text: $prompt, role: .user)
            StreamingReply(text: $reply, phase: phase) { action in
                if action == .regenerate { reply = ""; phase = .thinking; run += 1 }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(UIColor { @Sendable traits in traits.userInterfaceStyle == .dark ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1) : UIColor(red: 0.953, green: 0.949, blue: 0.933, alpha: 1) }))
        // Keyed on the run, not the phase, so moving to .streaming doesn't cancel the stream.
        .task(id: run) {
            do {
                try await Task.sleep(for: .seconds(1.2))
                phase = .streaming
                // Streams arrive in chunks of a few words.
                let words = full.split(separator: " ")
                for index in stride(from: 0, to: words.count, by: 3) {
                    try await Task.sleep(for: .milliseconds(240))
                    reply += (reply.isEmpty ? "" : " ") + words[index..<min(index + 3, words.count)].joined(separator: " ")
                }
                phase = .done
            } catch {}
        }
    }
}

#Preview("Light") {
    StreamingReplyExample().preferredColorScheme(.light)
}

#Preview("Dark") {
    StreamingReplyExample().preferredColorScheme(.dark)
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, shake)

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

/// A short decaying side-to-side shake for refused input, each time `trigger` changes. Under Reduce Motion it stays
/// still (same view, no identity change): pair it with a color or message change and the error haptic.
private struct PieceShake: ViewModifier {
    let trigger: AnyHashable
    var distance: CGFloat = 8
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let distance = reduceMotion ? 0 : distance
        content.keyframeAnimator(initialValue: CGFloat(0), trigger: trigger) { view, x in
            view.offset(x: x)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(-distance, duration: 0.06)
                CubicKeyframe(distance * 0.75, duration: 0.07)
                CubicKeyframe(-distance * 0.5, duration: 0.07)
                CubicKeyframe(distance * 0.25, duration: 0.06)
                SpringKeyframe(0, duration: 0.12, spring: Spring(duration: 0.18, bounce: 0))
            }
        }
    }
}

private extension View {
    /// Shakes this view side to side once each time `trigger` changes, for input that was refused.
    func pieceShake(trigger: some Hashable & Sendable, distance: CGFloat = 8) -> some View {
        modifier(PieceShake(trigger: AnyHashable(trigger), distance: distance))
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.0 (liquid, liquidPress, liquidPop, bud, morphText)

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

/// `piecePop` for glass: dips, swells past full size and lands each time `trigger` changes, on the same timings,
/// through `pieceLiquidScale` so the glass and what it carries pop together. Driven from state rather than a
/// keyframe animator, since the liquid scale can't be set from inside one. Still under Reduce Motion.
private struct PieceLiquidPop: ViewModifier {
    let trigger: AnyHashable
    var amount: CGFloat = 0.08
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scale: CGFloat = 1
    @State private var run = 0

    func body(content: Content) -> some View {
        content
            .pieceLiquidScale(scale)
            .onChange(of: trigger) { _, _ in
                guard !reduceMotion else { return }
                run += 1
                let mine = run
                withAnimation(.easeInOut(duration: 0.08)) { scale = 1 - amount * 0.4 }
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(80))
                    guard run == mine else { return }
                    withAnimation(.spring(duration: 0.18, bounce: 0)) { scale = 1 + amount }
                    try? await Task.sleep(for: .milliseconds(140))
                    guard run == mine else { return }
                    withAnimation(.spring(PieceMotion.expressive)) { scale = 1 }
                }
            }
    }
}

private extension View {
    /// Pops this view's glass each time `trigger` changes. Use a counter, never a Bool that can flip back before it fires.
    func pieceLiquidPop(trigger: some Hashable & Sendable, amount: CGFloat = 0.08) -> some View {
        modifier(PieceLiquidPop(trigger: AnyHashable(trigger), amount: amount))
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

/// A label that changes letter by letter: letters both strings share hold still, the rest blur out and the new ones
/// blur in a few milliseconds apart. Under Reduce Motion it cross-fades. VoiceOver reads the whole string.
private struct PieceMorphText: View {
    var text: String
    var font: Font = .body.weight(.semibold)
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let glyphs = Array(text)
        HStack(spacing: 0) {
            ForEach(glyphs.indices, id: \.self) { i in
                Text(String(glyphs[i]))
                    .id("\(i)\(glyphs[i])")
                    .transition(transition(i))
            }
        }
        .font(font)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
    }

    private func transition(_ i: Int) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return AnyTransition(.blurReplace(.downUp)).combined(with: .scale(scale: 0.6, anchor: .bottom))
            .animation(.spring(duration: 0.42, bounce: 0.3).delay(Double(i) * 0.022))
    }
}

// swiftpieces-liquid: end
