// swiftpieces:
// title: Address Field
// description: An address field for checkout, delivery and sign-up that lists type-ahead suggestions under a soft 56pt block with the matched text in bold, picks one with a tap or the hardware keyboard, shows a spinner on the chosen row while it resolves into a structured address with street, city, state, postal code, country and coordinate, then settles into the field with the locality on a second line and a sage check, keeping the typed text usable with a "Use as typed" row and an inline retry when a lookup fails.
// category: inputs
// minIOSVersion: "17.0"
// version: "1.0.0"
// added: "2026-09-29"
// tags: [address, autocomplete, mapkit, checkout, delivery, form, search]

import Contacts
import MapKit
import SwiftUI

/// Address entry with type-ahead suggestions that resolve to a structured, verified address.
///
/// Typing searches after a short pause (three characters or more). Each new keystroke cancels the search
/// in flight, so a slow answer for an older query never replaces a newer one. Picking a suggestion looks up
/// the full address; when it arrives, `address` is set, `text` becomes the address's first line (usually the
/// street) and the locality shows under it. Editing the text again clears `address`. Location permission is
/// never requested: suggestions come from the query alone, optionally biased by `region`.
///
/// ```swift
/// @State private var query = ""
/// @State private var address: AddressField.Address?
///
/// AddressField("Delivery address", text: $query, address: $address, countries: ["US", "CA"])
/// ```
///
/// - Parameters:
///   - label: The placeholder shown while the field is empty, and its accessibility label.
///   - text: Bound text. Set by typing, and to the address's first line once a suggestion resolves.
///   - address: The resolved address, or `nil` while there is none. Setting it from outside (a saved address) fills the field and skips searching. Editing the text sets it back to `nil`.
///   - region: Biases suggestions toward an area, such as the city a store delivers in. `nil` searches everywhere, starting with the device's region.
///   - source: Where suggestions and addresses come from. `nil` (the default) uses MapKit. Pass your own for a geocoding backend, previews or tests.
///   - countries: ISO 3166 country codes that are accepted, such as `["US", "CA"]`. Suggestions clearly in another country are left out, and a picked address outside the list shows an inline error instead of being set. Empty accepts every country.
///   - allowsUnverified: When `true`, a "Use as typed" row appears when there are no matches or a lookup fails, and picking it sets an address with `isVerified == false` holding only the typed text.
///   - style: Colors and field metrics. Defaults to the SwiftPieces house palette, adapting to light and dark.
public struct AddressField: View {
    /// A resolved address. Parts that a lookup did not return are `nil`.
    public struct Address: Hashable, Sendable, Codable {
        /// The street line with the house number, formatted for the country, such as "1 Infinite Loop" or "Hauptstraße 5".
        public let street: String?
        /// City, town or locality.
        public let city: String?
        /// State, province, prefecture or county, as the country abbreviates it ("CA", "ON").
        public let state: String?
        /// Postal or ZIP code.
        public let postalCode: String?
        /// Country name, localized.
        public let country: String?
        /// ISO 3166-1 alpha-2 country code in upper case, such as "US".
        public let isoCountryCode: String?
        /// Latitude of the address, when known.
        public let latitude: Double?
        /// Longitude of the address, when known.
        public let longitude: Double?
        /// The whole address on one line, formatted for its country.
        public let formatted: String
        /// `true` when the address came from a lookup; `false` for text the person chose to use as typed.
        public let isVerified: Bool

        /// Builds an address. `formatted` is composed from the parts, in the country's postal format, when you leave it `nil`.
        public init(street: String? = nil, city: String? = nil, state: String? = nil, postalCode: String? = nil, country: String? = nil, isoCountryCode: String? = nil, coordinate: CLLocationCoordinate2D? = nil, formatted: String? = nil, isVerified: Bool = true) {
            self.street = street.nonBlank
            self.city = city.nonBlank
            self.state = state.nonBlank
            self.postalCode = postalCode.nonBlank
            self.country = country.nonBlank
            self.isoCountryCode = isoCountryCode.nonBlank?.uppercased()
            self.latitude = coordinate?.latitude
            self.longitude = coordinate?.longitude
            let parts = Self.mailingLines(street: self.street, city: self.city, state: self.state, postalCode: self.postalCode, country: self.country, isoCountryCode: self.isoCountryCode)
            self.formatted = formatted.nonBlank?.collapsingSpaces ?? parts.joined(separator: ", ")
            self.isVerified = isVerified
        }

        /// The coordinate, when the lookup returned one.
        public var coordinate: CLLocationCoordinate2D? {
            guard let latitude, let longitude else { return nil }
            return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        }

        /// The address as the lines of a mailing label, ordered and formatted for its country (for example the postal
        /// code before the city in Germany). Falls back to `formatted` when there are no parts.
        public var mailingLines: [String] {
            let lines = Self.mailingLines(street: street, city: city, state: state, postalCode: postalCode, country: country, isoCountryCode: isoCountryCode)
            return lines.isEmpty ? [formatted] : lines
        }

        /// What the field shows once this address is set: the first line (usually the street).
        var fieldText: String { street ?? mailingLines.first ?? formatted }

        /// Everything after the first line, on one line, for the field's second line. The country is left out
        /// when it is the device's own region, the way the system shortens addresses.
        var localityLine: String? {
            var lines = Array(mailingLines.dropFirst())
            if lines.count > 1, let country, lines.last == country, let code = isoCountryCode, code == Locale.current.region?.identifier {
                lines.removeLast()
            }
            return lines.isEmpty ? nil : lines.joined(separator: ", ")
        }

        private static func mailingLines(street: String?, city: String?, state: String?, postalCode: String?, country: String?, isoCountryCode: String?) -> [String] {
            guard [street, city, state, postalCode, country].contains(where: { $0 != nil }) else { return [] }
            let postal = CNMutablePostalAddress()
            postal.street = street ?? ""
            postal.city = city ?? ""
            postal.state = state ?? ""
            postal.postalCode = postalCode ?? ""
            postal.country = country ?? ""
            postal.isoCountryCode = isoCountryCode?.lowercased() ?? ""
            return CNPostalAddressFormatter.string(from: postal, style: .mailingAddress)
                .split(whereSeparator: \.isNewline)
                .map { String($0).collapsingSpaces }
                .filter { !$0.isEmpty }
        }
    }

    /// One row in the suggestion list.
    public struct Suggestion: Identifiable, Hashable, Sendable {
        /// Stable identity. Also how your `Source.resolve` finds what it needs.
        public let id: String
        /// The first line, such as "1 Infinite Loop".
        public let title: String
        /// The locality line, such as "Cupertino, CA, United States". May be empty.
        public let subtitle: String
        /// Runs of `title` that match the query, drawn in bold. Empty bolds the query where it appears.
        public let highlights: [Range<String.Index>]

        public init(id: String? = nil, title: String, subtitle: String = "", highlights: [Range<String.Index>] = []) {
            self.id = id ?? "\(title)\n\(subtitle)"
            self.title = title
            self.subtitle = subtitle
            self.highlights = highlights
        }
    }

    /// Where suggestions and addresses come from. The field cancels a call whose result is no longer wanted.
    public struct Source: Sendable {
        /// Returns suggestions for a trimmed query of three characters or more.
        public var suggest: @MainActor @Sendable (_ query: String) async throws -> [Suggestion]
        /// Resolves a suggestion from the latest `suggest` call into an address.
        public var resolve: @MainActor @Sendable (_ suggestion: Suggestion) async throws -> Address

        public init(suggest: @escaping @MainActor @Sendable (_ query: String) async throws -> [Suggestion], resolve: @escaping @MainActor @Sendable (_ suggestion: Suggestion) async throws -> Address) {
            self.suggest = suggest
            self.resolve = resolve
        }

        /// MapKit address search, biased toward `region`. Each call to this makes a new search session, so create it once
        /// (for example in `@State`) rather than in `body`. The field's default already does this.
        @MainActor public static func mapKit(region: MKCoordinateRegion? = nil) -> Source {
            let search = MapKitAddressSearch()
            return Source(
                suggest: { try await search.suggestions(for: $0, region: region) },
                resolve: { try await search.resolve($0) }
            )
        }
    }

    /// Colors and metrics. `.standard` is the house palette.
    public struct Style: Sendable {
        /// The field block and the suggestion list.
        public var field: Color
        /// Typed text and suggestion titles.
        public var label: Color
        /// Placeholder, icons, the locality line and suggestion subtitles.
        public var secondaryLabel: Color
        /// The 2pt ring while focused.
        public var focusRing: Color
        /// The highlighted and pressed suggestion row.
        public var highlight: Color
        /// The verified check block.
        public var success: Color
        /// Lookup errors.
        public var error: Color
        /// Glyphs on solid blocks.
        public var ink: Color
        /// The pin at the front of the field: the one accent at rest.
        public var pin: Color
        /// Suggestion tiles. Each suggestion keeps the same block (picked from its text), so one color gives uniform tiles.
        public var tiles: [Color]
        /// Minimum field height. Grows with Dynamic Type and the locality line.
        public var height: CGFloat
        /// Field corner radius. Rows use a smaller radius that follows it.
        public var cornerRadius: CGFloat

        /// Pass only what you want to change; `nil` keeps the house palette value.
        public init(field: Color? = nil, label: Color? = nil, secondaryLabel: Color? = nil, focusRing: Color? = nil, highlight: Color? = nil, success: Color? = nil, error: Color? = nil, ink: Color? = nil, pin: Color? = nil, tiles: [Color]? = nil, height: CGFloat = 56, cornerRadius: CGFloat = 18) {
            self.field = field ?? adaptive(light: 0xEBE9E3, dark: 0x262626)
            self.label = label ?? adaptive(light: 0x141414, dark: 0xF4F3EF)
            self.secondaryLabel = secondaryLabel ?? adaptive(light: 0x5C5A56, dark: 0xA6A49F)
            self.focusRing = focusRing ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.highlight = highlight ?? adaptive(light: 0xDCD9D1, dark: 0x3A3A3A)
            self.success = success ?? adaptive(light: 0xA9DCB7, dark: 0xA9DCB7)
            self.error = error ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.ink = ink ?? adaptive(light: 0x141414, dark: 0x141414)
            self.pin = pin ?? adaptive(light: 0xFF0000, dark: 0xFF0000)
            self.tiles = (tiles?.isEmpty == false ? tiles : nil) ?? [0x9CC2FF, 0xFFD976, 0xA9DCB7, 0xCDB8FF].map { adaptive(light: $0, dark: $0) }
            self.height = max(height, 44)
            self.cornerRadius = cornerRadius
        }

        public static let standard = Style()

        /// A stable tile per suggestion, so a row never changes color as the list refines.
        func tile(for key: String) -> Color {
            var hash: UInt64 = 5381
            for scalar in key.lowercased().unicodeScalars { hash = (hash &* 33) &+ UInt64(scalar.value) }
            return tiles[Int(hash % UInt64(tiles.count))]
        }
    }

    private enum Status: Equatable {
        case idle
        case loaded
        case empty
        case failed(String)
    }

    private struct Failure: Equatable {
        let id: Suggestion.ID
        let message: String
        /// False for an address outside `countries`: trying again would give the same answer.
        let canRetry: Bool
    }

    private struct SearchKey: Equatable {
        let query: String
        let attempt: Int
    }

    /// Queries shorter than this (after trimming) don't search.
    private static let minimumQueryLength = 3
    nonisolated private static let typedRowID = "\u{0}typed"

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @FocusState private var isFocused: Bool
    @ScaledMetric(relativeTo: .body) private var iconWidth: CGFloat = 32
    @ScaledMetric(relativeTo: .body) private var badgeSize: CGFloat = 26
    @ScaledMetric(relativeTo: .body) private var rowHeight: CGFloat = 52
    @Binding private var text: String
    @Binding private var address: Address?
    /// Lives for the field's lifetime; its completer is created on the first search.
    @State private var mapKit = MapKitAddressSearch()
    @State private var suggestions: [Suggestion] = []
    @State private var status: Status = .idle
    @State private var isLoading = false
    /// True after an edit, false once the person leaves the field, presses Escape or picks.
    @State private var isActive = false
    @State private var highlightedID: String?
    @State private var resolvingID: Suggestion.ID?
    @State private var failure: Failure?
    @State private var resolveTask: Task<Void, Never>?
    @State private var attempt = 0
    /// The last value written to `text` by the field itself, so the change it causes is not treated as an edit.
    @State private var programmatic: String?
    @State private var announcedCount: Int?
    @State private var pickTick = 0
    @State private var moveTick = 0
    @State private var successTick = 0
    @State private var errorTick = 0

    private let label: String
    private let region: MKCoordinateRegion?
    private let source: Source?
    private let countries: Set<String>
    private let allowsUnverified: Bool
    private let style: Style

    public init(_ label: String, text: Binding<String>, address: Binding<Address?>, region: MKCoordinateRegion? = nil, countries: Set<String> = [], allowsUnverified: Bool = true, style: Style = .standard) {
        self.init(label, text: text, address: address, region: region, source: nil, countries: countries, allowsUnverified: allowsUnverified, style: style)
    }

    public init(_ label: String, text: Binding<String>, address: Binding<Address?>, source: Source, countries: Set<String> = [], allowsUnverified: Bool = true, style: Style = .standard) {
        self.init(label, text: text, address: address, region: nil, source: source, countries: countries, allowsUnverified: allowsUnverified, style: style)
    }

    private init(_ label: String, text: Binding<String>, address: Binding<Address?>, region: MKCoordinateRegion?, source: Source?, countries: Set<String>, allowsUnverified: Bool, style: Style) {
        self.label = label
        self._text = text
        self._address = address
        self.region = region
        self.source = source
        self.countries = Set(countries.map { $0.uppercased() })
        self.allowsUnverified = allowsUnverified
        self.style = style
    }

    private var motion: Animation { reduceMotion ? .smooth(duration: 0.2) : .spring(duration: 0.38, bounce: 0.16) }
    private var query: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    /// What the search task follows. Leaving the field doesn't change it, so results survive a blur (and a pick in flight).
    private var searchQuery: String { address == nil ? query : "" }

    public var body: some View {
        let rows = self.rows
        VStack(alignment: .leading, spacing: 8) {
            field
            if !rows.isEmpty {
                panel(rows)
                    .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
            }
        }
        .opacity(isEnabled ? 1 : 0.45)
        .animation(motion, value: rows.map(\.id))
        .animation(motion, value: address)
        .animation(.smooth(duration: 0.2), value: resolvingID)
        .animation(.smooth(duration: 0.2), value: failure)
        .sensoryFeedback(.selection, trigger: moveTick)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: pickTick)
        .sensoryFeedback(.success, trigger: successTick)
        .sensoryFeedback(.error, trigger: errorTick)
        .task(id: SearchKey(query: searchQuery, attempt: attempt)) { await search() }
        .onChange(of: text) { old, new in textChanged(from: old, to: new) }
        .onChange(of: address) { _, new in addressChanged(to: new) }
        .onChange(of: isFocused) { _, focused in
            // Coming back to the field brings back the suggestions it had.
            isActive = focused && address == nil && status != .idle
        }
        .onAppear {
            // A saved address passed in on first appearance fills an empty field.
            if let address, query.isEmpty { setText(address.fieldText) }
        }
        .onDisappear { resolveTask?.cancel() }
    }

    // MARK: Field

    private var field: some View {
        let shape = RoundedRectangle(cornerRadius: style.cornerRadius, style: .continuous)
        return HStack(spacing: 12) {
            if showsRowGlyphs {
                Image(systemName: "mappin.and.ellipse")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(style.pin)
                    .frame(width: iconWidth)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 2) {
                // Vertical axis so a long street wraps instead of scrolling out of view; Return arrives as a
                // line break, which `textChanged` turns into a submit.
                TextField(label, text: $text, prompt: Text(label).foregroundStyle(style.secondaryLabel), axis: .vertical)
                    .font(.body)
                    .lineLimit(1...3)
                    .foregroundStyle(style.label)
                    .tint(style.label)
                    .focused($isFocused)
                    .textContentType(.fullStreetAddress)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.done)
                    .onKeyPress(.downArrow) { moveHighlight(by: 1) }
                    .onKeyPress(.upArrow) { moveHighlight(by: -1) }
                    .onKeyPress(.escape) {
                        guard isActive else { return .ignored }
                        isActive = false
                        return .handled
                    }
                    .accessibilityLabel(label)
                    .accessibilityHint(fieldHint)
                if let address, let line = address.isVerified ? address.localityLine : String(localized: "Used as typed") {
                    Text(line)
                        .font(.subheadline)
                        .foregroundStyle(style.secondaryLabel)
                        .lineLimit(2)
                        .transition(.opacity)
                        .accessibilityHidden(true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            accessory
        }
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, minHeight: style.height, alignment: .leading)
        .background(style.field, in: shape)
        .overlay {
            shape.strokeBorder(style.focusRing, lineWidth: 2)
                .opacity(isFocused ? 1 : 0)
        }
        .contentShape(shape)
        .onTapGesture { if isEnabled { isFocused = true } }
        .animation(.smooth(duration: 0.2), value: isFocused)
        .animation(.smooth(duration: 0.2), value: isLoading)
    }

    /// Spinner while searching, the verified check once resolved, otherwise a clear button while editing.
    @ViewBuilder private var accessory: some View {
        ZStack {
            if isLoading && address == nil {
                ProgressView()
                    .controlSize(.small)
                    .tint(style.secondaryLabel)
                    .transition(.opacity)
            } else if let address, address.isVerified {
                Image(systemName: "checkmark")
                    .font(.system(size: min(badgeSize, 36) * 0.46, weight: .heavy))
                    .foregroundStyle(style.ink)
                    .frame(width: min(badgeSize, 36), height: min(badgeSize, 36))
                    .background(style.success, in: .circle)
                    .transition(reduceMotion ? .opacity : .scale(scale: 0.4).combined(with: .opacity))
                    .accessibilityHidden(true)
            } else if isFocused && !text.isEmpty {
                Button(action: clear) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.body)
                        .foregroundStyle(style.secondaryLabel)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(String(localized: "Clear address"))
                .transition(.opacity)
            }
        }
        .frame(minWidth: 44, minHeight: 44)
        .contentShape(.rect)
    }

    private var fieldHint: String {
        guard let address else { return String(localized: "Type to see address suggestions.") }
        if address.isVerified { return String(localized: "Verified address: \(address.formatted)") }
        return String(localized: "Used as typed, not verified.")
    }

    // MARK: Suggestions

    private enum Row: Identifiable {
        case suggestion(Suggestion)
        case typed(String)
        case empty
        case failed(String)

        var id: String {
            switch self {
            case .suggestion(let s): s.id
            case .typed: AddressField.typedRowID
            case .empty: "\u{0}empty"
            case .failed: "\u{0}failed"
            }
        }

        var isPickable: Bool {
            switch self {
            case .suggestion, .typed: true
            case .empty, .failed: false
            }
        }
    }

    private var rows: [Row] { rows(includingInactive: false) }

    /// `includingInactive` is for Return: the field may already have ended editing when `onSubmit` runs.
    private func rows(includingInactive: Bool) -> [Row] {
        // The list stays up while a pick resolves or shows its error, even if Return ended editing.
        guard address == nil, includingInactive || isActive || resolvingID != nil || failure != nil else { return [] }
        guard query.count >= Self.minimumQueryLength else { return [] }
        var rows: [Row]
        switch status {
        case .idle: return []
        case .loaded: rows = suggestions.map(Row.suggestion)
        case .empty: rows = [.empty]
        case .failed(let message): rows = [.failed(message)]
        }
        let offersTyped = status == .empty || failure != nil || { if case .failed = status { return true } else { return false } }()
        if allowsUnverified, offersTyped { rows.append(.typed(query)) }
        return rows
    }

    private func panel(_ rows: [Row]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(rows) { row in
                switch row {
                case .suggestion(let suggestion): suggestionRow(suggestion)
                case .typed(let typed): typedRow(typed)
                case .empty: emptyRow
                case .failed(let message): failedRow(message)
                }
            }
        }
        .padding(6)
        .background(style.field, in: .rect(cornerRadius: style.cornerRadius, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(String(localized: "Address suggestions"))
    }

    private var rowRadius: CGFloat { max(style.cornerRadius - 6, 6) }
    /// At accessibility sizes the row glyphs step aside so titles get the width.
    private var showsRowGlyphs: Bool { !dynamicTypeSize.isAccessibilitySize }

    /// A row's leading glyph column, so titles line up with the field's text.
    @ViewBuilder private func rowGlyph(_ name: String) -> some View {
        if showsRowGlyphs {
            Image(systemName: name)
                .font(.body.weight(.semibold))
                .foregroundStyle(style.secondaryLabel)
                .frame(width: iconWidth)
                .accessibilityHidden(true)
        }
    }

    /// A suggestion's leading tile: a small solid block with the pin in ink.
    @ViewBuilder private func suggestionTile(_ suggestion: Suggestion) -> some View {
        if showsRowGlyphs {
            RoundedRectangle(cornerRadius: iconWidth * 0.3, style: .continuous)
                .fill(style.tile(for: suggestion.title))
                .frame(width: iconWidth, height: iconWidth)
                .overlay {
                    Image(systemName: "mappin")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(style.ink)
                }
                .accessibilityHidden(true)
        }
    }

    private func suggestionRow(_ suggestion: Suggestion) -> some View {
        let isResolving = resolvingID == suggestion.id
        let failed = failure?.id == suggestion.id ? failure : nil
        let isHighlighted = highlightedID == suggestion.id
        return Button { pick(suggestion) } label: {
            HStack(spacing: 12) {
                suggestionTile(suggestion)
                VStack(alignment: .leading, spacing: 2) {
                    Text(highlighted(suggestion))
                        .font(.body)
                        .foregroundStyle(style.label)
                        .lineLimit(2)
                    if let failed {
                        Text(failed.message)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(style.error)
                            .transition(.opacity)
                    } else if !suggestion.subtitle.isEmpty {
                        Text(suggestion.subtitle)
                            .font(.subheadline)
                            .foregroundStyle(style.secondaryLabel)
                            .lineLimit(2)
                    }
                }
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                if isResolving {
                    ProgressView()
                        .controlSize(.small)
                        .tint(style.label)
                        .transition(.opacity)
                } else if failed?.canRetry == true {
                    Text("Retry")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(style.field)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(style.label, in: .capsule)
                        .transition(.opacity)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, minHeight: max(rowHeight, 44), alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(RowButtonStyle(highlight: style.highlight, isHighlighted: isHighlighted || isResolving, radius: rowRadius, reduceMotion: reduceMotion))
        .opacity(resolvingID != nil && !isResolving ? 0.4 : 1)
        .accessibilityLabel(suggestion.subtitle.isEmpty ? suggestion.title : "\(suggestion.title), \(suggestion.subtitle)")
        .accessibilityValue(isResolving ? String(localized: "Finding address") : failed?.message ?? "")
        .accessibilityHint(failed.map { $0.canRetry ? String(localized: "Tries again.") : "" } ?? String(localized: "Fills in this address."))
        .accessibilityAddTraits(isHighlighted ? .isSelected : [])
    }

    private func typedRow(_ typed: String) -> some View {
        let isHighlighted = highlightedID == Self.typedRowID
        return Button(action: useTyped) {
            HStack(spacing: 12) {
                rowGlyph("character.cursor.ibeam")
                VStack(alignment: .leading, spacing: 2) {
                    Text("Use \u{201C}\(typed)\u{201D}")
                        .font(.body.weight(.medium))
                        .foregroundStyle(style.label)
                        .lineLimit(2)
                    Text("Keep it exactly as typed")
                        .font(.subheadline)
                        .foregroundStyle(style.secondaryLabel)
                }
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, minHeight: max(rowHeight, 44), alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(RowButtonStyle(highlight: style.highlight, isHighlighted: isHighlighted, radius: rowRadius, reduceMotion: reduceMotion))
        .opacity(resolvingID != nil ? 0.4 : 1)
        .accessibilityLabel(String(localized: "Use as typed: \(typed)"))
        .accessibilityHint(String(localized: "Sets the address without verifying it."))
        .accessibilityAddTraits(isHighlighted ? .isSelected : [])
    }

    private var emptyRow: some View {
        Text("No matching addresses")
            .font(.subheadline)
            .foregroundStyle(style.secondaryLabel)
            .padding(.leading, showsRowGlyphs ? iconWidth + 12 : 0)
            .padding(.horizontal, 10)
            .frame(maxWidth: .infinity, minHeight: 40, alignment: .leading)
    }

    private func failedRow(_ message: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark")
                .font(.caption.weight(.heavy))
                .foregroundStyle(style.ink)
                .frame(width: 22, height: 22)
                .background(style.error, in: .circle)
                .frame(width: iconWidth)
                .accessibilityHidden(true)
            Text(message)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(style.label)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button { attempt += 1 } label: {
                Text("Retry")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(style.field)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(style.label, in: .capsule)
                    .frame(minHeight: 44)
                    .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(String(localized: "Retry suggestions"))
        }
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, minHeight: max(rowHeight, 44), alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    /// Matched runs in bold: the source's ranges when it gave any, otherwise the query where it appears.
    private func highlighted(_ suggestion: Suggestion) -> AttributedString {
        let title = suggestion.title
        var ranges = suggestion.highlights.filter { $0.lowerBound >= title.startIndex && $0.upperBound <= title.endIndex }
        if ranges.isEmpty, let match = title.range(of: query, options: [.caseInsensitive, .diacriticInsensitive]) { ranges = [match] }
        var result = AttributedString()
        var cursor = title.startIndex
        for range in ranges.sorted(by: { $0.lowerBound < $1.lowerBound }) where range.lowerBound >= cursor {
            result += AttributedString(String(title[cursor..<range.lowerBound]))
            var bold = AttributedString(String(title[range]))
            bold.font = .body.weight(.bold)
            result += bold
            cursor = range.upperBound
        }
        result += AttributedString(String(title[cursor...]))
        return result
    }

    // MARK: Searching

    private func search() async {
        let query = searchQuery
        guard query.count >= Self.minimumQueryLength else {
            isLoading = false
            resetResults()
            return
        }
        // Text filled in without an edit (a prefilled value on appear) doesn't search until the person edits it.
        guard isActive else {
            isLoading = false
            return
        }
        // Debounce: a keystroke inside this window cancels the task before anything is sent.
        do { try await Task.sleep(for: .milliseconds(250)) } catch { return }
        isLoading = true
        do {
            let found: [Suggestion]
            if let source { found = try await source.suggest(query) } else { found = try await mapKit.suggestions(for: query, region: region) }
            guard !Task.isCancelled else { return }
            var seen = Set<String>()
            let kept = Array(found.filter { seen.insert($0.id).inserted && isAllowed($0) }.prefix(5))
            isLoading = false
            suggestions = kept
            status = kept.isEmpty ? .empty : .loaded
            if let highlightedID, highlightedID != Self.typedRowID, !kept.contains(where: { $0.id == highlightedID }) { self.highlightedID = nil }
            if announcedCount != kept.count {
                announcedCount = kept.count
                announce(kept.isEmpty ? String(localized: "No matching addresses") : Self.countPhrase(kept.count))
            }
        } catch {
            guard !Task.isCancelled, !(error is CancellationError) else { return }
            isLoading = false
            suggestions = []
            status = .failed(String(localized: "Couldn\u{2019}t load suggestions"))
            announcedCount = nil
            announce(String(localized: "Couldn\u{2019}t load suggestions"))
        }
    }

    /// "5 suggestions", with the noun inflected for the current language.
    private static func countPhrase(_ count: Int) -> String {
        String(AttributedString(localized: "^[\(count) suggestion](inflect: true)").characters)
    }

    /// Leaves out suggestions whose last line names a country outside `countries`. Anything ambiguous is kept and checked after resolving.
    private func isAllowed(_ suggestion: Suggestion) -> Bool {
        guard !countries.isEmpty else { return true }
        let tail = suggestion.subtitle.split(separator: ",").last.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
        guard let code = CountryNames.code(for: tail) else { return true }
        return countries.contains(code)
    }

    private func resetResults() {
        suggestions = []
        status = .idle
        highlightedID = nil
        announcedCount = nil
    }

    // MARK: Picking

    private func pick(_ suggestion: Suggestion) {
        guard isEnabled else { return }
        resolveTask?.cancel()
        failure = nil
        highlightedID = suggestion.id
        resolvingID = suggestion.id
        pickTick += 1
        announce(String(localized: "Finding address"))
        resolveTask = Task {
            do {
                let resolved: Address
                if let source { resolved = try await source.resolve(suggestion) } else { resolved = try await mapKit.resolve(suggestion) }
                guard !Task.isCancelled, resolvingID == suggestion.id else { return }
                if let message = countryProblem(resolved) {
                    fail(suggestion, message: message, canRetry: false)
                } else {
                    complete(with: resolved)
                }
            } catch {
                guard !Task.isCancelled, !(error is CancellationError), resolvingID == suggestion.id else { return }
                let message = (error as? LocalizedError)?.errorDescription ?? String(localized: "Couldn\u{2019}t find that address")
                fail(suggestion, message: message, canRetry: true)
            }
        }
    }

    private func countryProblem(_ address: Address) -> String? {
        guard !countries.isEmpty else { return nil }
        if let code = address.isoCountryCode, countries.contains(code) { return nil }
        if countries.count == 1, let only = countries.first, let name = Locale.current.localizedString(forRegionCode: only) {
            return String(localized: "Choose an address in \(name)")
        }
        return String(localized: "Choose an address in a supported country")
    }

    private func fail(_ suggestion: Suggestion, message: String, canRetry: Bool) {
        resolvingID = nil
        failure = Failure(id: suggestion.id, message: message, canRetry: canRetry)
        errorTick += 1
        announce(message)
    }

    private func complete(with resolved: Address) {
        resolvingID = nil
        failure = nil
        isActive = false
        setText(resolved.fieldText)
        address = resolved
        resetResults()
        successTick += 1
        announce(resolved.isVerified ? String(localized: "Address set: \(resolved.formatted)") : String(localized: "Address set as typed"))
        isFocused = false
    }

    private func useTyped() {
        guard isEnabled, !query.isEmpty else { return }
        resolveTask?.cancel()
        pickTick += 1
        complete(with: Address(formatted: query, isVerified: false))
    }

    private func submit() {
        let pickable = rows(includingInactive: true).filter(\.isPickable)
        let target = pickable.first(where: { $0.id == highlightedID }) ?? pickable.first
        switch target {
        case .suggestion(let suggestion): pick(suggestion)
        case .typed: useTyped()
        default: isFocused = false // Nothing to pick: Done just ends editing.
        }
    }

    private func moveHighlight(by step: Int) -> KeyPress.Result {
        let ids = rows.filter(\.isPickable).map(\.id)
        guard !ids.isEmpty else { return .ignored }
        let current = highlightedID.flatMap { ids.firstIndex(of: $0) }
        let next = current.map { min(max($0 + step, 0), ids.count - 1) } ?? (step > 0 ? 0 : ids.count - 1)
        if ids[next] != highlightedID {
            highlightedID = ids[next]
            moveTick += 1
        }
        return .handled
    }

    private func clear() {
        resolveTask?.cancel()
        resolvingID = nil
        failure = nil
        address = nil
        setText("")
        resetResults()
        isFocused = true
    }

    // MARK: Edits

    private func setText(_ value: String) {
        guard text != value else { return }
        programmatic = value
        text = value
    }

    private func textChanged(from old: String, to new: String) {
        if new == programmatic {
            programmatic = nil
            return
        }
        if new.contains(where: \.isNewline) {
            // One line break typed is Return: pick. More text arriving at once is a paste of a multi-line address: join it.
            if new.count - old.count == 1 {
                setText(new.filter { !$0.isNewline })
                submit()
                return
            }
            let joined = new.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.joined(separator: ", ")
            setText(joined)
        }
        // Text and address set together from outside (a saved address) is not an edit.
        if let address, address.fieldText == new { return }
        resolveTask?.cancel()
        resolvingID = nil
        failure = nil
        highlightedID = nil
        if address != nil { address = nil }
        isActive = isEnabled
    }

    private func addressChanged(to new: Address?) {
        guard let new else { return }
        resolveTask?.cancel()
        resolvingID = nil
        failure = nil
        isActive = false
        resetResults()
        setText(new.fieldText)
    }

    private func announce(_ message: String) {
        AccessibilityNotification.Announcement(message).post()
    }
}

// MARK: - Row style

/// A suggestion row: the highlight block on press, keyboard highlight or while resolving, and a slight press-in.
private struct RowButtonStyle: ButtonStyle {
    let highlight: Color
    let isHighlighted: Bool
    let radius: CGFloat
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(highlight)
                    .opacity(configuration.isPressed || isHighlighted ? 1 : 0)
            }
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.985 : 1)
            .animation(.spring(duration: 0.25, bounce: 0.2), value: configuration.isPressed)
            .animation(.smooth(duration: 0.15), value: isHighlighted)
    }
}

// MARK: - MapKit

/// Bridges `MKLocalSearchCompleter` (delegate based) and `MKLocalSearch` (completion based) to cancellable async calls.
///
/// Every call gets a token. A newer call, or cancelling the calling task, finishes the older continuation with
/// `CancellationError`, so a late answer can never be delivered to the wrong query. A retry of the same fragment
/// (which the completer would ignore) or a region change starts a fresh completer.
@MainActor
private final class MapKitAddressSearch: NSObject, MKLocalSearchCompleterDelegate {
    private enum LookupError: LocalizedError {
        case notFound
        var errorDescription: String? { String(localized: "Couldn\u{2019}t find that address") }
    }

    private var completer: MKLocalSearchCompleter?
    private var completerRegion: MKCoordinateRegion?
    private var nextToken = 0
    private var pendingSuggest: (token: Int, continuation: CheckedContinuation<[AddressField.Suggestion], Error>)?
    private var pendingResolve: (token: Int, search: MKLocalSearch, continuation: CheckedContinuation<AddressField.Address, Error>)?
    /// The completions behind the latest suggestions, by suggestion id, for resolving.
    private var completions: [String: MKLocalSearchCompletion] = [:]

    func suggestions(for query: String, region: MKCoordinateRegion?) async throws -> [AddressField.Suggestion] {
        nextToken += 1
        let token = nextToken
        pendingSuggest?.continuation.resume(throwing: CancellationError())
        pendingSuggest = nil
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                pendingSuggest = (token, continuation)
                let completer = completer(for: query, region: region)
                completer.queryFragment = query
            }
        } onCancel: {
            Task { @MainActor [weak self] in self?.finishSuggest(token: token, with: .failure(CancellationError())) }
        }
    }

    func resolve(_ suggestion: AddressField.Suggestion) async throws -> AddressField.Address {
        guard let completion = completions[suggestion.id] else { throw LookupError.notFound }
        nextToken += 1
        let token = nextToken
        if let pendingResolve {
            pendingResolve.search.cancel()
            pendingResolve.continuation.resume(throwing: CancellationError())
            self.pendingResolve = nil
        }
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let search = MKLocalSearch(request: MKLocalSearch.Request(completion: completion))
                pendingResolve = (token, search, continuation)
                search.start { [weak self] response, error in
                    guard let self else { return }
                    if let item = response?.mapItems.first {
                        self.finishResolve(token: token, with: .success(Self.address(from: item)))
                    } else {
                        self.finishResolve(token: token, with: .failure(error ?? LookupError.notFound))
                    }
                }
            }
        } onCancel: {
            Task { @MainActor [weak self] in self?.finishResolve(token: token, with: .failure(CancellationError())) }
        }
    }

    private func completer(for query: String, region: MKCoordinateRegion?) -> MKLocalSearchCompleter {
        if let completer, completer.queryFragment != query, Self.same(completerRegion, region) { return completer }
        completer?.delegate = nil
        completer?.cancel()
        let fresh = MKLocalSearchCompleter()
        fresh.resultTypes = .address
        if let region { fresh.region = region }
        fresh.delegate = self
        completer = fresh
        completerRegion = region
        return fresh
    }

    private static func same(_ a: MKCoordinateRegion?, _ b: MKCoordinateRegion?) -> Bool {
        switch (a, b) {
        case (nil, nil): true
        case let (a?, b?): a.center.latitude == b.center.latitude && a.center.longitude == b.center.longitude && a.span.latitudeDelta == b.span.latitudeDelta && a.span.longitudeDelta == b.span.longitudeDelta
        default: false
        }
    }

    private func finishSuggest(token: Int, with result: Result<[AddressField.Suggestion], Error>) {
        guard let pending = pendingSuggest, pending.token == token else { return }
        pendingSuggest = nil
        pending.continuation.resume(with: result)
    }

    private func finishResolve(token: Int, with result: Result<AddressField.Address, Error>) {
        guard let pending = pendingResolve, pending.token == token else { return }
        pendingResolve = nil
        if case .failure = result { pending.search.cancel() }
        pending.continuation.resume(with: result)
    }

    // The completer calls its delegate on the main thread.
    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let id = ObjectIdentifier(completer)
        MainActor.assumeIsolated { self.completerUpdated(id) }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        let id = ObjectIdentifier(completer)
        // No matches arrive as an error; treat them as an empty list.
        let isNoMatch = (error as? MKError)?.code == .placemarkNotFound
        let failure = error.localizedDescription
        MainActor.assumeIsolated { self.completerFailed(id, noMatch: isNoMatch, message: failure) }
    }

    private func completerUpdated(_ id: ObjectIdentifier) {
        guard let completer, ObjectIdentifier(completer) == id, let token = pendingSuggest?.token else { return }
        var map: [String: MKLocalSearchCompletion] = [:]
        let suggestions = completer.results.map { completion in
            let title = completion.title
            let highlights = completion.titleHighlightRanges.compactMap { Range($0.rangeValue, in: title) }
            let suggestion = AddressField.Suggestion(title: title, subtitle: completion.subtitle, highlights: highlights)
            map[suggestion.id] = completion
            return suggestion
        }
        completions = map
        finishSuggest(token: token, with: .success(suggestions))
    }

    private func completerFailed(_ id: ObjectIdentifier, noMatch: Bool, message: String) {
        guard let completer, ObjectIdentifier(completer) == id, let token = pendingSuggest?.token else { return }
        if noMatch {
            completions = [:]
            finishSuggest(token: token, with: .success([]))
        } else {
            finishSuggest(token: token, with: .failure(MKError(.serverFailure, userInfo: [NSLocalizedDescriptionKey: message])))
        }
    }

    /// Reads the structured parts. iOS 26 moves map items to `MKAddress`, whose strings carry no separate street or
    /// postal code, and deprecates `placemark`; see `structuredPlacemark(of:)`.
    private static func address(from item: MKMapItem) -> AddressField.Address {
        let coordinate: CLLocationCoordinate2D
        let placemark: CLPlacemark?
        var formatted: String?
        var city: String?
        var country: String?
        var isoCountryCode: String?
        if #available(iOS 26.0, *) {
            coordinate = item.location.coordinate
            placemark = structuredPlacemark(of: item)
            let representations = item.addressRepresentations
            formatted = representations?.fullAddress(includingRegion: true, singleLine: true) ?? item.address?.fullAddress
            city = representations?.cityName
            country = representations?.regionName
            isoCountryCode = representations?.region?.identifier
        } else {
            coordinate = item.placemark.coordinate
            placemark = item.placemark
        }
        let postal = placemark?.postalAddress
        let street = postal?.street.nonBlank ?? [placemark?.subThoroughfare, placemark?.thoroughfare].compactMap(\.self).joined(separator: " ").nonBlank
        let parts = AddressField.Address(
            street: street,
            city: postal?.city.nonBlank ?? placemark?.locality ?? city,
            state: postal?.state.nonBlank ?? placemark?.administrativeArea,
            postalCode: postal?.postalCode.nonBlank ?? placemark?.postalCode,
            country: postal?.country.nonBlank ?? placemark?.country ?? country,
            isoCountryCode: postal?.isoCountryCode.nonBlank ?? placemark?.isoCountryCode ?? isoCountryCode,
            coordinate: coordinate
        )
        // Parts win when the lookup returned them, so the line follows the country's postal format; the system string covers the rest.
        guard parts.street == nil || parts.postalCode == nil, let formatted else { return parts }
        return AddressField.Address(street: parts.street, city: parts.city, state: parts.state, postalCode: parts.postalCode, country: parts.country, isoCountryCode: parts.isoCountryCode, coordinate: coordinate, formatted: formatted)
    }

    /// On iOS 26 the map item still carries its placemark at runtime, but only through a deprecated property, and
    /// `MKAddress` has no separate street or postal code. The placemark is read dynamically so the file builds
    /// without deprecation warnings; if a future release drops it, the address falls back to the iOS 26 strings
    /// (full line, city, country and country code) with street and postal code left `nil`.
    @available(iOS 26.0, *)
    private static func structuredPlacemark(of item: MKMapItem) -> CLPlacemark? {
        let key = "placemark"
        guard item.responds(to: NSSelectorFromString(key)) else { return nil }
        return item.value(forKey: key) as? CLPlacemark
    }
}

// MARK: - Helpers

/// Localized country names to ISO codes, for filtering suggestions by their last line.
private enum CountryNames {
    static let byName: [String: String] = {
        var map: [String: String] = [:]
        let locales = [Locale.current, Locale(identifier: "en_US")]
        for region in Locale.Region.isoRegions where region.identifier.count == 2 {
            for locale in locales {
                if let name = locale.localizedString(forRegionCode: region.identifier) { map[fold(name)] = region.identifier }
            }
        }
        return map
    }()

    static func code(for name: String) -> String? { byName[fold(name)] }

    private static func fold(_ text: String) -> String { text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil) }
}

private extension Optional where Wrapped == String {
    var nonBlank: String? { self?.nonBlank }
}

private extension String {
    var nonBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// System strings sometimes carry double spaces ("CA  95014").
    var collapsingSpaces: String {
        split(whereSeparator: { $0 == " " || $0 == "\u{00A0}" }).joined(separator: " ")
    }
}

/// A house-palette color that follows the interface style.
private func adaptive(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

/// A delivery address that accepts the United States and Canada, and a saved address passed in.
private struct AddressFieldExample: View {
    @State private var query = ""
    @State private var address: AddressField.Address?
    @State private var savedQuery = ""
    @State private var saved: AddressField.Address? = AddressField.Address(
        street: "48 Juniper Lane", city: "Bellmont", state: "OR", postalCode: "97321", country: "United States", isoCountryCode: "US",
        coordinate: CLLocationCoordinate2D(latitude: 44.6, longitude: -123.1)
    )

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                AddressField("Delivery address", text: $query, address: $address, countries: ["US", "CA"])
                AddressField("Billing address", text: $savedQuery, address: $saved)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(adaptive(light: 0xF3F2EE, dark: 0x121212))
    }
}

#Preview("Light") {
    AddressFieldExample()
}

#Preview("Dark") {
    AddressFieldExample()
        .preferredColorScheme(.dark)
}
