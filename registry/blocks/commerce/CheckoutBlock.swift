// swiftpieces:
// title: Checkout
// description: "A three-step checkout: a step trail you can go back along, bag lines with quantity steppers and Undo, an address and a delivery speed, then one Pay button that runs your payment to the placed order."
// category: commerce
// version: "1.0.0"
// minIOSVersion: "17.0"
// added: "2026-10-19"
// tags: [commerce, checkout, cart, bag, delivery, payment, address, order]
// registryDependencies: [StepTrail, ScrubStepper, AddressField, CommitButton]

import MapKit
import SwiftUI

/// A three-step checkout section, Bag, Delivery and Pay, for a shop or ordering app to place in a sheet or a screen.
///
/// A `StepTrail` at the top follows the step people are on and takes them back to any step they have reached. The bag
/// lists each line with a `ScrubStepper` for its quantity; at zero the line turns into a removed row with Undo, and
/// removed lines leave the bag when people move on. Delivery is an `AddressField`, whose suggestions resolve to a
/// verified address, and a choice of speed. Pay shows where the order goes, the payment method and the totals, and a
/// `CommitButton` that runs `onPay`: on success the trail completes and the section shows the placed order, on failure
/// the button offers a retry. Continue stays disabled until its step is complete, and a step that stops being complete
/// (an emptied bag, a cleared address) can't be skipped past.
///
/// - Parameters:
///   - checkout: The checkout your app owns: the bag's lines, the address, the delivery options and the chosen one, the payment method, the currency and an optional tax rate. The block writes quantities, the address and the delivery choice back to it.
///   - countries: ISO 3166 country codes you deliver to, such as `["US", "CA"]`. Suggestions elsewhere are left out and an address outside them is refused in the field. Empty accepts every country.
///   - addressRegion: Biases address suggestions toward an area, such as the city a store delivers in. `nil` searches everywhere, starting with the device's region.
///   - addressSource: Where address suggestions come from, for your own geocoding backend, previews or tests. `nil` (the default) uses MapKit, which needs no location permission and no Info.plist key.
///   - onChangePayment: Called by the Change button on the payment method row; present your own picker and set `checkout.payment`. `nil` hides the button.
///   - onPay: Runs the payment for the order shown, on the main actor. Return when it went through, or throw: a `LocalizedError`'s `errorDescription` shows under the button, which offers a retry.
public struct CheckoutBlock: View {
    /// One line in the bag.
    public struct LineItem: Identifiable, Hashable, Sendable {
        /// Stable identity, such as your SKU. Defaults to the name and variant.
        public var id: String
        /// The product's name, such as "Stoneware Mug".
        public var name: String
        /// The variant people chose, such as "Sage glaze, 12 oz". Empty shows nothing.
        public var variant: String
        /// The price of one, in the checkout's currency.
        public var unitPrice: Decimal
        /// How many are in the bag. Zero is a removed line: it shows Undo until people move on, then leaves the bag.
        public var quantity: Int
        /// The most people can take, the stepper's upper bound.
        public var maximumQuantity: Int
        /// The small tile drawn for the line.
        public var thumbnail: Thumbnail

        public init(id: String? = nil, name: String, variant: String = "", unitPrice: Decimal, quantity: Int = 1, maximumQuantity: Int = 10, thumbnail: Thumbnail = Thumbnail()) {
            self.id = id ?? "\(name)\n\(variant)"
            self.name = name
            self.variant = variant
            self.unitPrice = unitPrice
            self.maximumQuantity = max(maximumQuantity, 1)
            self.quantity = min(max(quantity, 0), max(maximumQuantity, 1))
            self.thumbnail = thumbnail
        }

        /// The line's price: the unit price times the quantity.
        public var total: Decimal { unitPrice * Decimal(quantity) }
    }

    /// The tile drawn for a line: an SF Symbol in ink on a solid house colour. Never an image or a URL.
    public struct Thumbnail: Hashable, Sendable {
        /// The tile's colour. Ink reads on every house colour; a custom one should be as light.
        public enum Tile: Hashable, Sendable {
            case sage, butter, sky, lilac, sand
            case custom(Color)
        }

        /// The SF Symbol on the tile, such as `"mug.fill"`.
        public var symbol: String
        public var tile: Tile

        public init(symbol: String = "shippingbox.fill", tile: Tile = .sand) {
            self.symbol = symbol
            self.tile = tile
        }
    }

    /// A delivery speed people can choose.
    public struct DeliveryOption: Identifiable, Hashable, Sendable {
        public var id: String
        /// Its name, such as "Express".
        public var title: String
        /// When it arrives, as your app words it: "Arrives tomorrow", "In 4–5 days".
        public var estimate: String
        /// What it costs. Zero shows as Free.
        public var price: Decimal

        public init(id: String? = nil, title: String, estimate: String, price: Decimal) {
            self.id = id ?? title
            self.title = title
            self.estimate = estimate
            self.price = price
        }
    }

    /// The payment method the order is paid with, as your app describes it. The block draws a generic mark for its
    /// kind; it never shows a network or wallet logo.
    public struct PaymentMethod: Hashable, Sendable {
        /// What the mark beside it draws.
        public enum Kind: Hashable, Sendable {
            /// A small drawn card.
            case card
            /// A wallet glyph, for a device wallet.
            case wallet
            /// A bank glyph, for an account or direct debit.
            case account
        }

        /// The method's name, such as "Visa ending 4242" or "Apple Pay".
        public var title: String
        /// A second line, such as "Expires 08/28". Empty shows nothing.
        public var detail: String
        public var kind: Kind

        public init(title: String, detail: String = "", kind: Kind = .card) {
            self.title = title
            self.detail = detail
            self.kind = kind
        }
    }

    /// The checkout your app owns and binds to the block.
    public struct Checkout: Hashable, Sendable {
        /// The bag. The block writes quantities back, and drops lines at zero once people leave the bag.
        public var items: [LineItem]
        /// The address field's text. The field sets it to the address's first line once one resolves.
        public var addressText: String
        /// The resolved delivery address, or `nil` until there is one. Set it to start from a saved address.
        public var address: AddressField.Address?
        /// The speeds people choose from. Empty skips the choice.
        public var deliveryOptions: [DeliveryOption]
        /// The chosen speed's `id`, or `nil` until people choose.
        public var deliveryID: DeliveryOption.ID?
        /// The method shown on the Pay step.
        public var payment: PaymentMethod
        /// ISO 4217 code every price is in, such as "USD". Amounts format in the person's locale.
        public var currencyCode: String
        /// Sales tax as a fraction of the subtotal, such as `0.0825`. `nil` shows no tax line.
        public var taxRate: Decimal?

        public init(items: [LineItem], addressText: String = "", address: AddressField.Address? = nil, deliveryOptions: [DeliveryOption] = [], deliveryID: DeliveryOption.ID? = nil, payment: PaymentMethod, currencyCode: String = Locale.current.currency?.identifier ?? "USD", taxRate: Decimal? = nil) {
            self.items = items
            self.addressText = addressText
            self.address = address
            self.deliveryOptions = deliveryOptions
            self.deliveryID = deliveryID
            self.payment = payment
            self.currencyCode = currencyCode
            self.taxRate = taxRate
        }

        /// How many things are in the bag.
        public var itemCount: Int { items.reduce(0) { $0 + max($1.quantity, 0) } }
        /// The lines' totals added up.
        public var subtotal: Decimal { items.reduce(Decimal(0)) { $0 + $1.total } }
        /// The chosen delivery option, if any.
        public var delivery: DeliveryOption? { deliveryOptions.first { $0.id == deliveryID } }
        /// The chosen delivery's price, or zero.
        public var deliveryPrice: Decimal { delivery?.price ?? 0 }
        /// The subtotal times `taxRate`, rounded to the currency's minor unit.
        public var tax: Decimal { CheckoutMoney.rounded((subtotal * (taxRate ?? 0)), code: currencyCode) }
        /// Subtotal, delivery and tax.
        public var total: Decimal { subtotal + deliveryPrice + tax }
    }

    /// What `onPay` is asked to charge: a snapshot of the checkout as people saw it on the Pay step.
    public struct Order: Hashable, Sendable {
        /// The lines with a quantity above zero.
        public let items: [LineItem]
        public let address: AddressField.Address
        /// The chosen speed, or `nil` when the checkout offers none.
        public let delivery: DeliveryOption?
        public let payment: PaymentMethod
        public let currencyCode: String
        public let subtotal: Decimal
        public let deliveryPrice: Decimal
        public let tax: Decimal
        /// The amount on the Pay button.
        public let total: Decimal
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.locale) private var locale
    @Binding private var checkout: Checkout

    /// The trail's selection: where people asked to be.
    @State private var step = 0
    /// The step whose content shows. It follows `step` a turn later, so the outgoing step leaves the right way.
    @State private var shown = 0
    /// The furthest step people have moved on to.
    @State private var furthest = 0
    /// 1 moving on, -1 going back.
    @State private var travel: CGFloat = 1
    @State private var payPhase: CommitButton.Phase = .idle
    /// Why the last payment failed, from the app's error.
    @State private var payFailure: String?
    @State private var paying = false
    /// The order once it is paid. The trail completes and the section shows it.
    @State private var placed: Order?

    private let countries: Set<String>
    private let addressRegion: MKCoordinateRegion?
    private let addressSource: AddressField.Source?
    private let onChangePayment: (() -> Void)?
    private let onPay: @MainActor (Order) async throws -> Void

    public init(checkout: Binding<Checkout>, countries: Set<String> = [], addressRegion: MKCoordinateRegion? = nil, addressSource: AddressField.Source? = nil, onChangePayment: (() -> Void)? = nil, onPay: @escaping @MainActor (Order) async throws -> Void) {
        self._checkout = checkout
        self.countries = countries
        self.addressRegion = addressRegion
        self.addressSource = addressSource
        self.onChangePayment = onChangePayment
        self.onPay = onPay
    }

    /// The button labels are one line that never truncates, so they stop growing here, where "Payment failed" and a
    /// four-figure total still fit beside the ring at 320 points wide.
    private static let largestButtonText = DynamicTypeSize.accessibility2

    private static let titles = [
        String(localized: "Bag", comment: "Checkout step: the items being bought"),
        String(localized: "Delivery", comment: "Checkout step: address and delivery speed"),
        String(localized: "Pay", comment: "Checkout step: summary and payment"),
    ]

    public var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            StepTrail(
                steps: Self.titles,
                selection: $step,
                reached: reachable,
                messages: .init(label: String(localized: "Checkout progress")),
                // Monochrome, so the signal red stays on the one primary action below.
                style: .init(accent: CheckoutPalette.label, accentInk: CheckoutPalette.ground)
            )
            // Nothing moves while a payment is out or once the order is placed.
            .allowsHitTesting(!paying && placed == nil)
            ZStack(alignment: .top) {
                content(for: shown)
                    .id(shown)
                    .transition(stepTransition)
            }
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .fontWeight(.semibold)
        .foregroundStyle(CheckoutPalette.label)
        .onChange(of: step) { old, new in stepChanged(from: old, to: new) }
        .onChange(of: reachable) { _, limit in
            // The app emptied the bag or cleared the address from outside: step back to what is still complete.
            if placed == nil, !paying, step > limit { step = limit }
        }
    }

    // MARK: Steps

    @ViewBuilder private func content(for step: Int) -> some View {
        switch step {
        case 0: bag
        case 1: delivery
        case 2: pay
        default: placedOrder
        }
    }

    /// Moving between steps: the outgoing step slides a little the way the trail moved and blurs out while its room
    /// closes, the incoming one blurs in from the other side. Under Reduce Motion they cross-fade.
    private var stepTransition: AnyTransition {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let leaving = AnyTransition.modifier(
            active: CheckoutStepShift(x: reduceMotion ? 0 : -28 * travel, blur: reduceMotion ? 0 : 6, opacity: 0, collapsed: true),
            identity: CheckoutStepShift()
        )
        let arriving = AnyTransition.modifier(
            active: CheckoutStepShift(x: reduceMotion ? 0 : 28 * travel, blur: reduceMotion ? 0 : 6, opacity: 0),
            identity: CheckoutStepShift()
        )
        return .asymmetric(insertion: arriving.animation(motion.reveal), removal: leaving.animation(motion.dismiss))
    }

    private var bagReady: Bool { checkout.items.contains { $0.quantity > 0 } }
    private var deliveryReady: Bool { checkout.address != nil && (checkout.deliveryOptions.isEmpty || checkout.delivery != nil) }

    /// The last step people may go to: the furthest they moved on to, short of any step that is no longer complete.
    private var reachable: Int {
        var limit = furthest
        if !bagReady { limit = min(limit, 0) }
        if !deliveryReady { limit = min(limit, 1) }
        return limit
    }

    private func stepChanged(from old: Int, to new: Int) {
        // Once the order is placed the trail stays complete.
        if placed != nil, new != Self.titles.count {
            step = Self.titles.count
            return
        }
        // Leaving Pay before paying starts it over; the placed order keeps the button on Paid as it goes.
        if old == 2, !paying, placed == nil {
            payPhase = .idle
            payFailure = nil
        }
        travel = new >= old ? 1 : -1
        let motion = PieceMotion(reduceMotion: reduceMotion)
        Task { @MainActor in
            withAnimation(motion.reveal) { shown = new }
            // Removed lines leave the bag once its step has gone.
            guard old == 0, new != 0 else { return }
            try? await Task.sleep(for: .milliseconds(600))
            if shown != 0 { checkout.items.removeAll { $0.quantity <= 0 } }
        }
    }

    private func advance() {
        let next = min(step + 1, Self.titles.count - 1)
        furthest = max(furthest, next)
        step = next
    }

    // MARK: Bag

    private var bag: some View {
        VStack(alignment: .leading, spacing: 16) {
            if checkout.items.isEmpty {
                emptyBag
            } else {
                CheckoutCard {
                    ForEach(Array(checkout.items.enumerated()), id: \.element.id) { index, item in
                        if index > 0 { CheckoutHairline(inset: 16) }
                        CheckoutLineRow(item: item, quantity: quantity(of: item.id), currencyCode: checkout.currencyCode)
                    }
                }
                subtotal
            }
            CommitButton(String(localized: "Continue"), phase: .constant(bagReady ? .idle : .disabled), action: advance)
                .dynamicTypeSize(...Self.largestButtonText)
                .padding(.top, 4)
        }
    }

    /// A line's quantity, found by its id, so a line leaving the bag never strands a binding.
    private func quantity(of id: LineItem.ID) -> Binding<Int> {
        let model = $checkout
        return Binding(
            get: { model.wrappedValue.items.first { $0.id == id }?.quantity ?? 0 },
            set: { value in
                guard let index = model.wrappedValue.items.firstIndex(where: { $0.id == id }) else { return }
                model.wrappedValue.items[index].quantity = value
            }
        )
    }

    private var subtotal: some View {
        let count = checkout.itemCount
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return ZStack(alignment: .leading) {
            if count > 0 {
                CheckoutAmountRow(
                    title: String(localized: "Subtotal"),
                    detail: CheckoutMoney.items(count),
                    amount: checkout.subtotal,
                    currencyCode: checkout.currencyCode
                )
                .transition(motion.swap)
            } else {
                Text("Nothing in your bag")
                    .font(.body)
                    .foregroundStyle(CheckoutPalette.secondary)
                    .transition(motion.swap)
            }
        }
        .padding(.horizontal, 4)
        .animation(motion.snap, value: count > 0)
    }

    private var emptyBag: some View {
        VStack(spacing: 12) {
            CheckoutTile(color: CheckoutPalette.sand, size: 56) {
                Image(systemName: "bag")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(CheckoutPalette.ink)
            }
            VStack(spacing: 4) {
                Text("Your bag is empty")
                    .font(.title3)
                Text("Add something and it shows up here.")
                    .font(.subheadline)
                    .foregroundStyle(CheckoutPalette.secondary)
            }
            .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .padding(.horizontal, 20)
        .background(CheckoutPalette.card, in: .rect(cornerRadius: 22, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: Delivery

    private var delivery: some View {
        VStack(alignment: .leading, spacing: 10) {
            CheckoutSectionLabel(String(localized: "Deliver to"))
            addressField
            if !checkout.deliveryOptions.isEmpty {
                CheckoutSectionLabel(String(localized: "Delivery speed"))
                    .padding(.top, 14)
                CheckoutCard {
                    ForEach(Array(checkout.deliveryOptions.enumerated()), id: \.element.id) { index, option in
                        if index > 0 { CheckoutHairline(inset: 56) }
                        CheckoutDeliveryRow(
                            option: option,
                            price: CheckoutMoney.price(option.price, code: checkout.currencyCode, locale: locale),
                            selected: checkout.deliveryID == option.id
                        ) {
                            checkout.deliveryID = option.id
                        }
                    }
                }
                .sensoryFeedback(.selection, trigger: checkout.deliveryID)
            }
            CommitButton(String(localized: "Continue"), phase: .constant(deliveryReady ? .idle : .disabled), action: advance)
                .dynamicTypeSize(...Self.largestButtonText)
                .padding(.top, 18)
        }
    }

    @ViewBuilder private var addressField: some View {
        let label = String(localized: "Delivery address")
        if let addressSource {
            AddressField(label, text: $checkout.addressText, address: $checkout.address, source: addressSource, countries: countries)
        } else {
            AddressField(label, text: $checkout.addressText, address: $checkout.address, region: addressRegion, countries: countries)
        }
    }

    // MARK: Pay

    private var pay: some View {
        let total = CheckoutMoney.format(checkout.total, code: checkout.currencyCode, locale: locale)
        return VStack(alignment: .leading, spacing: 16) {
            CheckoutCard {
                if let address = checkout.address {
                    CheckoutRecapRow(address: address, delivery: checkout.delivery)
                    CheckoutHairline(inset: 72)
                }
                CheckoutPaymentRow(payment: checkout.payment, onChange: paying || placed != nil ? nil : onChangePayment)
                CheckoutHairline(inset: 16)
                totals
            }
            VStack(spacing: 10) {
                CommitButton(
                    String(localized: "Pay \(total)", comment: "Checkout pay button, such as Pay $64.00"),
                    phase: $payPhase,
                    // The block moves on to the placed order before this ends.
                    successHold: .seconds(30),
                    successTitle: String(localized: "Paid"),
                    action: submit
                )
                .dynamicTypeSize(...Self.largestButtonText)
                // A total changed from outside starts the button over with the new amount.
                .id(total)
                if let payFailure {
                    CheckoutFailureLine(message: payFailure)
                        .transition(PieceMotion(reduceMotion: reduceMotion).swap)
                }
            }
            .animation(PieceMotion(reduceMotion: reduceMotion).error, value: payFailure)
        }
    }

    private var totals: some View {
        let code = checkout.currencyCode
        return VStack(spacing: 10) {
            CheckoutAmountRow(title: String(localized: "Subtotal"), detail: CheckoutMoney.items(checkout.itemCount), amount: checkout.subtotal, currencyCode: code)
            if let delivery = checkout.delivery {
                CheckoutAmountRow(title: String(localized: "Delivery"), detail: delivery.title, amount: delivery.price, currencyCode: code, freeWhenZero: true)
            }
            if let rate = checkout.taxRate {
                CheckoutAmountRow(title: String(localized: "Tax"), detail: rate.formatted(.percent.precision(.fractionLength(0...2)).locale(locale)), amount: checkout.tax, currencyCode: code)
            }
            CheckoutAmountRow(title: String(localized: "Total"), amount: checkout.total, currencyCode: code, emphasized: true)
                .padding(.top, 4)
        }
        .padding(16)
    }

    /// The order as it stands, or `nil` while a step is incomplete.
    private var order: Order? {
        guard let address = checkout.address, bagReady, deliveryReady else { return nil }
        return Order(
            items: checkout.items.filter { $0.quantity > 0 },
            address: address,
            delivery: checkout.delivery,
            payment: checkout.payment,
            currencyCode: checkout.currencyCode,
            subtotal: checkout.subtotal,
            deliveryPrice: checkout.deliveryPrice,
            tax: checkout.tax,
            total: checkout.total
        )
    }

    private func submit() {
        guard let order, !paying else { return }
        paying = true
        payFailure = nil
        payPhase = .loading
        Task { @MainActor in
            do {
                try await onPay(order)
                payPhase = .success
                // Let the ring close on its check and the label turn to Paid, then show the order.
                try? await Task.sleep(for: .milliseconds(reduceMotion ? 900 : 1500))
                placed = order
                paying = false
                step = Self.titles.count
                AccessibilityNotification.Announcement(String(localized: "Order placed")).post()
            } catch {
                paying = false
                payPhase = .error(String(localized: "Payment failed"))
                payFailure = (error as? LocalizedError)?.errorDescription ?? String(localized: "Nothing was charged. Try again, or change the payment method.")
            }
        }
    }

    // MARK: Placed

    @ViewBuilder private var placedOrder: some View {
        if let placed {
            CheckoutPlacedCard(order: placed)
        }
    }
}

// MARK: - Line

/// One line in the bag: its tile, name and variant, the quantity stepper and the line's price. At zero it dims, and
/// once the stepper has rested there a moment it turns into a removed row with Undo, which brings back the quantity it
/// had.
private struct CheckoutLineRow: View {
    let item: CheckoutBlock.LineItem
    @Binding var quantity: Int
    let currencyCode: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.locale) private var locale
    @State private var removed = false
    @State private var restore: Int

    init(item: CheckoutBlock.LineItem, quantity: Binding<Int>, currencyCode: String) {
        self.item = item
        self._quantity = quantity
        self.currencyCode = currencyCode
        self._restore = State(initialValue: max(item.quantity, 1))
        self._removed = State(initialValue: item.quantity <= 0)
    }

    var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        ZStack(alignment: .top) {
            if removed {
                removedRow
                    .transition(.asymmetric(insertion: motion.swap.animation(motion.reveal), removal: .modifier(active: CheckoutStepShift(opacity: 0, collapsed: true), identity: CheckoutStepShift())))
            } else {
                fullRow
                    .transition(.asymmetric(insertion: motion.swap.animation(motion.reveal), removal: .modifier(active: CheckoutStepShift(blur: reduceMotion ? 0 : 4, opacity: 0, collapsed: true), identity: CheckoutStepShift())))
            }
        }
        .task(id: item.quantity) {
            guard item.quantity <= 0 else {
                restore = item.quantity
                if removed { withAnimation(motion.morph) { removed = false } }
                return
            }
            guard !removed else { return }
            // A finger may still be on the stepper: wait for it to rest at zero.
            try? await Task.sleep(for: .milliseconds(800))
            guard !Task.isCancelled, item.quantity <= 0 else { return }
            withAnimation(motion.morph) { removed = true }
            AccessibilityNotification.Announcement(String(localized: "\(item.name) removed")).post()
        }
    }

    private var fullRow: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let large = dynamicTypeSize.isAccessibilitySize
        return HStack(alignment: .top, spacing: 14) {
            // At accessibility sizes the tile steps aside so the name gets the width.
            if !large {
                CheckoutThumbnail(thumbnail: item.thumbnail)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 12) {
                // The line's price sits level with its name, the unit price beside the variant once there are several.
                // At accessibility sizes it goes under them, so the name keeps the width.
                let heading = large ? AnyLayout(VStackLayout(alignment: .leading, spacing: 6)) : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 12))
                heading {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.name)
                            .font(.body)
                        if !item.variant.isEmpty {
                            Text(item.variant)
                                .font(.subheadline)
                                .foregroundStyle(CheckoutPalette.secondary)
                        }
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    price(alignment: large ? .leading : .trailing)
                        .fixedSize(horizontal: !large, vertical: true)
                }
                .accessibilityElement(children: .combine)
                ScrubStepper(
                    value: $quantity,
                    in: 0...item.maximumQuantity,
                    // Neutral glass: the signal red belongs to the checkout's one primary action.
                    style: .init(button: .clear, glyph: CheckoutPalette.label, height: 44)
                )
                .fixedSize()
                .accessibilityLabel(String(localized: "Quantity, \(item.name)"))
            }
        }
        .padding(16)
        // A line at zero dims while it waits to be removed.
        .opacity(item.quantity > 0 ? 1 : 0.5)
        .animation(motion.snap, value: item.quantity > 0)
    }

    private func price(alignment: HorizontalAlignment) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        let total = item.total
        return VStack(alignment: alignment, spacing: 2) {
            Text(CheckoutMoney.format(total, code: currencyCode, locale: locale))
                .font(.body)
                .monospacedDigit()
                .contentTransition(reduceMotion ? .opacity : .numericText(value: CheckoutMoney.double(total)))
            if item.quantity > 1 {
                Text(String(localized: "\(CheckoutMoney.format(item.unitPrice, code: currencyCode, locale: locale)) each", comment: "Unit price under a line's total, such as $18.00 each"))
                    .font(.subheadline)
                    .foregroundStyle(CheckoutPalette.secondary)
                    .transition(motion.swap)
            }
        }
        // Amounts people read roll without overshoot.
        .animation(motion.value, value: item.quantity)
    }

    private var removedRow: some View {
        HStack(spacing: 12) {
            Text(String(localized: "\(item.name) removed", comment: "A line taken out of the bag, such as Stoneware Mug removed"))
                .font(.subheadline)
                .foregroundStyle(CheckoutPalette.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            CheckoutChip(title: String(localized: "Undo"), systemImage: "arrow.uturn.backward") {
                quantity = restore
            }
            .accessibilityHint(String(localized: "Puts \(item.name) back in the bag."))
        }
        .padding(.leading, 16)
        .padding(.trailing, 10)
        .padding(.vertical, 8)
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Delivery

/// A delivery speed: a radio mark, its name and arrival, and its price. The whole row is the target.
private struct CheckoutDeliveryRow: View {
    let option: CheckoutBlock.DeliveryOption
    let price: String
    let selected: Bool
    let action: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let large = dynamicTypeSize.isAccessibilitySize
        Button(action: action) {
            HStack(alignment: large ? .top : .center, spacing: 14) {
                CheckoutRadio(on: selected)
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.title)
                        .font(.body)
                    Text(option.estimate)
                        .font(.subheadline)
                        .foregroundStyle(CheckoutPalette.secondary)
                    // At accessibility sizes the price goes under the name, so neither breaks mid-word.
                    if large {
                        Text(price)
                            .font(.body)
                            .monospacedDigit()
                            .padding(.top, 4)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                if !large {
                    Text(price)
                        .font(.body)
                        .monospacedDigit()
                        .fixedSize()
                }
            }
            .multilineTextAlignment(.leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(CheckoutRowStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(option.title), \(option.estimate), \(price)")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

/// The selection mark: an empty ring, or an ink disc with a check that lands on the snap spring.
private struct CheckoutRadio: View {
    let on: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var size: CGFloat = 24

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(CheckoutPalette.subtle, lineWidth: 2)
                .opacity(on ? 0 : 1)
            Circle()
                .fill(CheckoutPalette.label)
                .scaleEffect(on || reduceMotion ? 1 : 0.4)
                .opacity(on ? 1 : 0)
            Image(systemName: "checkmark")
                .font(.system(size: size * 0.46, weight: .semibold))
                .foregroundStyle(CheckoutPalette.card)
                .scaleEffect(on || reduceMotion ? 1 : 0.5)
                .opacity(on ? 1 : 0)
        }
        .frame(width: size, height: size)
        .animation(PieceMotion(reduceMotion: reduceMotion).snap, value: on)
    }
}

/// A row in a card: a quiet wash while pressed and the shared press, a point deep, so the card stays steady.
private struct CheckoutRowStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        return configuration.label
            .background {
                Rectangle()
                    .fill(CheckoutPalette.label.opacity(0.06))
                    .opacity(configuration.isPressed ? 1 : 0)
                    .animation(configuration.isPressed ? nil : motion.dismiss, value: configuration.isPressed)
            }
            .piecePress(configuration.isPressed, depth: 1)
    }
}

// MARK: - Pay

/// Where the order goes: a pin tile, the address as mailing lines and the chosen speed.
private struct CheckoutRecapRow: View {
    let address: AddressField.Address
    let delivery: CheckoutBlock.DeliveryOption?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // At accessibility sizes the tile steps aside so the address gets the width.
            if !dynamicTypeSize.isAccessibilitySize {
                CheckoutTile(color: CheckoutPalette.well, size: 42) {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(CheckoutPalette.label)
                }
                .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 2) {
                let lines = CheckoutAddress.lines(address)
                Text(lines.first ?? address.formatted)
                    .font(.body)
                let rest = lines.dropFirst().joined(separator: ", ")
                if !rest.isEmpty {
                    Text(rest)
                        .font(.subheadline)
                        .foregroundStyle(CheckoutPalette.secondary)
                }
                if let delivery {
                    Text("\(delivery.title) · \(delivery.estimate)")
                        .font(.subheadline)
                        .foregroundStyle(CheckoutPalette.secondary)
                        .padding(.top, 4)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(String(localized: "Deliver to \(address.formatted)") + (delivery.map { ", \($0.title), \($0.estimate)" } ?? ""))
    }
}

/// The payment method: its drawn mark, its name and detail, and Change when the app offers one.
private struct CheckoutPaymentRow: View {
    let payment: CheckoutBlock.PaymentMethod
    let onChange: (() -> Void)?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let large = dynamicTypeSize.isAccessibilitySize
        // At accessibility sizes the mark steps aside and Change goes under the method's name.
        let layout = large ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(spacing: 14))
        return layout {
            if !large {
                CheckoutPaymentMark(kind: payment.kind)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(payment.title)
                    .font(.body)
                if !payment.detail.isEmpty {
                    Text(payment.detail)
                        .font(.subheadline)
                        .foregroundStyle(CheckoutPalette.secondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(String(localized: "Pay with \(payment.title)") + (payment.detail.isEmpty ? "" : ", \(payment.detail)"))
            if let onChange {
                CheckoutChip(title: String(localized: "Change"), action: onChange)
                    .accessibilityLabel(String(localized: "Change payment method"))
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, onChange == nil ? 16 : 10)
        .padding(.vertical, 14)
    }
}

/// A generic mark for a payment kind, drawn in code: a small card with a chip, or a wallet or bank glyph on a tile.
private struct CheckoutPaymentMark: View {
    let kind: CheckoutBlock.PaymentMethod.Kind

    var body: some View {
        switch kind {
        case .card:
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(CheckoutPalette.sky)
                .frame(width: 42, height: 30)
                .overlay(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(CheckoutPalette.ink.opacity(0.55))
                        .frame(width: 9, height: 7)
                        .padding(.leading, 7)
                        .padding(.top, 9)
                }
                .overlay(alignment: .bottomTrailing) {
                    HStack(spacing: 2) {
                        ForEach(0..<4, id: \.self) { _ in
                            Circle().fill(CheckoutPalette.ink.opacity(0.55)).frame(width: 3, height: 3)
                        }
                    }
                    .padding(.trailing, 6)
                    .padding(.bottom, 6)
                }
                .frame(width: 42, height: 42)
        case .wallet:
            CheckoutTile(color: CheckoutPalette.well, size: 42) {
                Image(systemName: "wallet.pass.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(CheckoutPalette.label)
            }
        case .account:
            CheckoutTile(color: CheckoutPalette.well, size: 42) {
                Image(systemName: "building.columns.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(CheckoutPalette.label)
            }
        }
    }
}

/// Why a payment failed, under the button: a small butter disc with an ink mark and the app's message.
private struct CheckoutFailureLine: View {
    let message: String
    @ScaledMetric(relativeTo: .footnote) private var mark: CGFloat = 20

    var body: some View {
        let mark = mark
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: "exclamationmark")
                .font(.system(size: mark * 0.55, weight: .semibold))
                .foregroundStyle(CheckoutPalette.ink)
                .frame(width: mark, height: mark)
                .background(CheckoutPalette.butter, in: .circle)
                .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + mark * 0.25 }
            Text(message)
                .font(.footnote)
                .foregroundStyle(CheckoutPalette.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 4)
        .accessibilityElement(children: .combine)
    }
}

/// The placed order: a sage check that lands with a pop, where and when it is going, and what was paid.
private struct CheckoutPlacedCard: View {
    let order: CheckoutBlock.Order
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.locale) private var locale
    @State private var landed = false

    var body: some View {
        let motion = PieceMotion(reduceMotion: reduceMotion)
        VStack(alignment: .leading, spacing: 16) {
            Image(systemName: "checkmark")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(CheckoutPalette.ink)
                .frame(width: 52, height: 52)
                .background(CheckoutPalette.sage, in: .circle)
                .scaleEffect(landed || reduceMotion ? 1 : 0.6)
                .opacity(landed ? 1 : 0)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("Order placed")
                    .font(.title2)
                if let delivery = order.delivery {
                    Text("\(delivery.title) · \(delivery.estimate)")
                        .font(.body)
                        .foregroundStyle(CheckoutPalette.secondary)
                }
                Text(CheckoutAddress.lines(order.address).joined(separator: ", "))
                    .font(.subheadline)
                    .foregroundStyle(CheckoutPalette.secondary)
            }
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityElement(children: .combine)
            CheckoutHairline(inset: 0)
            CheckoutAmountRow(
                title: String(localized: "Paid"),
                detail: order.payment.title,
                amount: order.total,
                currencyCode: order.currencyCode
            )
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CheckoutPalette.card, in: .rect(cornerRadius: 22, style: .continuous))
        .onAppear {
            withAnimation(motion.success.delay(reduceMotion ? 0 : 0.12)) { landed = true }
        }
    }
}

// MARK: - Parts

/// A section card: a plain adaptive fill with continuous corners, its rows stacked edge to edge.
private struct CheckoutCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CheckoutPalette.card, in: .rect(cornerRadius: 22, style: .continuous))
    }
}

/// A one-pixel rule between rows, starting `inset` points in from the leading edge.
private struct CheckoutHairline: View {
    let inset: CGFloat
    @Environment(\.displayScale) private var displayScale

    var body: some View {
        Rectangle()
            .fill(CheckoutPalette.hairline)
            .frame(height: 1 / max(displayScale, 1))
            .padding(.leading, inset)
            .accessibilityHidden(true)
    }
}

/// A quiet label over a section.
private struct CheckoutSectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(CheckoutPalette.secondary)
            .padding(.horizontal, 4)
            .accessibilityAddTraits(.isHeader)
    }
}

/// A rounded tile with something drawn on it.
private struct CheckoutTile<Content: View>: View {
    let color: Color
    let size: CGFloat
    @ViewBuilder var content: Content

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(color)
            .frame(width: size, height: size)
            .overlay { content }
    }
}

/// A line's tile: its symbol in ink on its house colour.
private struct CheckoutThumbnail: View {
    let thumbnail: CheckoutBlock.Thumbnail

    var body: some View {
        CheckoutTile(color: CheckoutPalette.tile(thumbnail.tile), size: 52) {
            Image(systemName: thumbnail.symbol)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(CheckoutPalette.ink)
        }
    }
}

/// A label and an amount on one line, the amount's digits rolling without overshoot. Wraps under itself when the
/// text is too large for one line.
private struct CheckoutAmountRow: View {
    let title: String
    var detail: String = ""
    let amount: Decimal
    let currencyCode: String
    var freeWhenZero = false
    var emphasized = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.locale) private var locale

    var body: some View {
        let value = freeWhenZero ? CheckoutMoney.price(amount, code: currencyCode, locale: locale) : CheckoutMoney.format(amount, code: currencyCode, locale: locale)
        let font: Font = emphasized ? .title3 : .body
        // One Text, so the detail wraps along with the title once the row stacks.
        let label = detail.isEmpty ? Text(title) : Text("\(title)  \(Text(detail).foregroundStyle(CheckoutPalette.secondary))")
        let figure = Text(value)
            .monospacedDigit()
            .contentTransition(reduceMotion ? .opacity : .numericText(value: CheckoutMoney.double(amount)))
            .animation(PieceMotion(reduceMotion: reduceMotion).value, value: amount)
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                label.lineLimit(1)
                Spacer(minLength: 0)
                figure.lineLimit(1)
            }
            VStack(alignment: .leading, spacing: 2) {
                label
                    .fixedSize(horizontal: false, vertical: true)
                figure
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(font)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(detail.isEmpty ? title : "\(title), \(detail)")
        .accessibilityValue(value)
    }
}

/// A small glass capsule for a secondary action inside a card: Undo, Change.
private struct CheckoutChip: View {
    let title: String
    var systemImage: String?
    let action: () -> Void
    @ScaledMetric(relativeTo: .subheadline) private var height: CGFloat = 36

    var body: some View {
        Button(action: action) {
            // No lift: inside a card the group's shadow would haze the rows around it.
            PieceLiquidGroup(lift: false) {
                HStack(spacing: 6) {
                    if let systemImage {
                        Image(systemName: systemImage)
                            .font(.footnote)
                    }
                    Text(title)
                        .font(.subheadline)
                }
                .foregroundStyle(CheckoutPalette.label)
                .padding(.horizontal, 14)
                .frame(minHeight: height)
                .pieceLiquid(Capsule(), interactive: false)
            }
            // A 44pt target around the smaller capsule.
            .frame(minHeight: 44)
            .contentShape(.rect)
        }
        .buttonStyle(PieceLiquidPressStyle())
        .fixedSize()
    }
}

/// The step change's moving parts, so a transition can blur, slide and fade a step, and close the room it leaves.
private struct CheckoutStepShift: ViewModifier {
    var x: CGFloat = 0
    var blur: CGFloat = 0
    var opacity: Double = 1
    /// Leaving, the step gives its height back as it goes, so the section shrinks with it rather than after it.
    var collapsed = false

    func body(content: Content) -> some View {
        content
            .blur(radius: blur)
            .offset(x: x)
            .opacity(opacity)
            .frame(height: collapsed ? 0 : nil, alignment: .top)
    }
}

// MARK: - Address

private enum CheckoutAddress {
    /// The address as mailing lines, without the country when it is the device's own, the way the system shortens
    /// addresses.
    static func lines(_ address: AddressField.Address) -> [String] {
        var lines = address.mailingLines
        if lines.count > 1, let country = address.country, lines.last == country, address.isoCountryCode == Locale.current.region?.identifier {
            lines.removeLast()
        }
        return lines
    }
}

// MARK: - Money

/// Currency in the person's locale from an ISO 4217 code, and rounding to the currency's minor unit.
private enum CheckoutMoney {
    static func format(_ value: Decimal, code: String, locale: Locale) -> String {
        value.formatted(.currency(code: code).locale(locale))
    }

    /// A price that reads Free at zero, for delivery.
    static func price(_ value: Decimal, code: String, locale: Locale) -> String {
        value == 0 ? String(localized: "Free", comment: "A delivery option that costs nothing") : format(value, code: code, locale: locale)
    }

    /// "3 items", with the noun inflected for the current language.
    static func items(_ count: Int) -> String {
        String(AttributedString(localized: "^[\(count) item](inflect: true)", comment: "How many things are in the bag").characters)
    }

    /// For `.numericText`, which rolls on a Double.
    static func double(_ value: Decimal) -> Double {
        NSDecimalNumber(decimal: value).doubleValue
    }

    /// `value` rounded half up to the currency's minor unit: two places for USD, none for JPY, three for KWD.
    static func rounded(_ value: Decimal, code: String) -> Decimal {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        var input = value
        var output = Decimal()
        NSDecimalRound(&output, &input, formatter.maximumFractionDigits, .plain)
        return output
    }
}

// MARK: - Palette

/// The house palette, adapting to light and dark. Change the block's colours here.
private enum CheckoutPalette {
    /// The screen behind the block.
    static let ground = checkoutColor(light: 0xF3F2EE, dark: 0x121212)
    /// Section cards.
    static let card = checkoutColor(light: 0xFFFFFF, dark: 0x1C1C1C)
    /// Neutral tiles inside a card.
    static let well = checkoutColor(light: 0xF0EEE9, dark: 0x2A2A2A)
    static let label = checkoutColor(light: 0x141414, dark: 0xF4F3EF)
    static let secondary = checkoutColor(light: 0x5C5A56, dark: 0xA6A49F)
    static let subtle = checkoutColor(light: 0xB4B2AC, dark: 0x5A5856)
    static let hairline = checkoutColor(light: 0xE6E4DE, dark: 0x2C2C2C)
    /// Ink on the solid blocks, in both appearances.
    static let ink = checkoutColor(light: 0x141414, dark: 0x141414)
    static let sage = checkoutColor(light: 0xA9DCB7, dark: 0xA9DCB7)
    static let butter = checkoutColor(light: 0xFFD976, dark: 0xFFD976)
    static let sky = checkoutColor(light: 0x9CC2FF, dark: 0x9CC2FF)
    static let lilac = checkoutColor(light: 0xCDB8FF, dark: 0xCDB8FF)
    static let sand = checkoutColor(light: 0xE9D5B3, dark: 0xE9D5B3)

    static func tile(_ tile: CheckoutBlock.Thumbnail.Tile) -> Color {
        switch tile {
        case .sage: sage
        case .butter: butter
        case .sky: sky
        case .lilac: lilac
        case .sand: sand
        case .custom(let color): color
        }
    }
}

/// A house-palette colour that follows the interface style.
private func checkoutColor(light: UInt32, dark: UInt32) -> Color {
    Color(uiColor: UIColor { @Sendable traits in
        let hex = traits.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

// MARK: - Example

#Preview("Usage") {
    @Previewable @State var checkout = CheckoutBlock.Checkout(
        items: [CheckoutBlock.LineItem(name: "Stoneware Mug", variant: "Sage glaze, 12 oz", unitPrice: 20, thumbnail: .init(symbol: "mug.fill", tile: .sage))],
        deliveryOptions: [CheckoutBlock.DeliveryOption(title: "Standard", estimate: "In 4–5 days", price: 0)],
        deliveryID: "Standard",
        payment: CheckoutBlock.PaymentMethod(title: "Visa ending 4242", detail: "Expires 08/28"),
        currencyCode: "USD"
    )
    ScrollView {
        CheckoutBlock(checkout: $checkout, countries: ["US"]) { order in
            try await Payments.charge(order)
        }
        .padding(20)
    }
}

#Preview("Example") {
    CheckoutBlockExample()
}

#Preview("Dark") {
    CheckoutBlockExample()
        .preferredColorScheme(.dark)
}

/// Stands in for your payment code in the Usage preview.
private enum Payments {
    static func charge(_ order: CheckoutBlock.Order) async throws {
        try await Task.sleep(for: .seconds(1.2))
    }
}

/// A coffee shop's bag in a sheet-like screen. Addresses come from a small fixed list, so the preview works offline,
/// and the first payment is declined so both outcomes show; the second goes through.
private struct CheckoutBlockExample: View {
    @State private var checkout = CheckoutBlockSample.checkout
    @State private var attempts = 0

    var body: some View {
        ScrollView {
            CheckoutBlock(checkout: $checkout, countries: ["US"], addressSource: CheckoutBlockSample.addresses, onChangePayment: {
                checkout.payment = checkout.payment.kind == .card
                    ? .init(title: "Device wallet", detail: "Default card", kind: .wallet)
                    : CheckoutBlockSample.card
            }) { _ in
                attempts += 1
                try await Task.sleep(for: .seconds(1.2))
                if attempts == 1 { throw CheckoutBlockSample.Declined() }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .background(CheckoutPalette.ground)
    }
}

private enum CheckoutBlockSample {
    static let card = CheckoutBlock.PaymentMethod(title: "Visa ending 4242", detail: "Expires 08/28", kind: .card)

    static let checkout = CheckoutBlock.Checkout(
        items: [
            CheckoutBlock.LineItem(name: "Stoneware Mug", variant: "Sage glaze, 12 oz", unitPrice: 20, quantity: 1, thumbnail: .init(symbol: "mug.fill", tile: .sage)),
            CheckoutBlock.LineItem(name: "House Blend", variant: "Whole bean, 340 g", unitPrice: 16, quantity: 1, thumbnail: .init(symbol: "leaf.fill", tile: .butter)),
        ],
        deliveryOptions: [
            CheckoutBlock.DeliveryOption(title: "Standard", estimate: "In 4–5 days", price: 0),
            CheckoutBlock.DeliveryOption(title: "Express", estimate: "Arrives tomorrow", price: 8),
        ],
        deliveryID: "Standard",
        payment: card,
        currencyCode: "USD"
    )

    static let address = AddressField.Address(
        street: "48 Juniper Lane", city: "Bellmont", state: "OR", postalCode: "97321", country: "United States", isoCountryCode: "US",
        coordinate: CLLocationCoordinate2D(latitude: 44.6, longitude: -123.1)
    )

    /// Three fictional addresses, matched as you type.
    static var addresses: AddressField.Source {
        AddressField.Source(
            suggest: { query in
                try await Task.sleep(for: .milliseconds(350))
                let all = [
                    AddressField.Suggestion(id: "juniper", title: "48 Juniper Lane", subtitle: "Bellmont, OR, United States"),
                    AddressField.Suggestion(id: "juniper-ct", title: "48 Juniper Court", subtitle: "Ashford, WA, United States"),
                    AddressField.Suggestion(id: "alder", title: "12 Alder Row", subtitle: "Bellmont, OR, United States"),
                ]
                return all.filter { $0.title.localizedCaseInsensitiveContains(query) }
            },
            resolve: { suggestion in
                try await Task.sleep(for: .milliseconds(600))
                guard suggestion.id != "juniper" else { return address }
                let city = suggestion.subtitle.components(separatedBy: ",").first
                return AddressField.Address(street: suggestion.title, city: city, country: "United States", isoCountryCode: "US")
            }
        )
    }

    struct Declined: LocalizedError {
        nonisolated var errorDescription: String? { "The card was declined. Nothing was charged; try again or change the card." }
    }
}

// MARK: - Piece motion
//
// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every
// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from
// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.
// swiftpieces-motion: 1.1.0 (core, pressMath, press)

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

/// Sinks on touch-down, leaning toward the touch if given, and springs back from the same lean. Under Reduce
/// Motion it shades instead of moving (darker in light mode, lighter in dark), without turning transparent.
private struct PiecePress: ViewModifier {
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
        content
            .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
            .brightness(pressed && reduceMotion ? (colorScheme == .dark ? 0.1 : -0.08) : 0)
            .scaleEffect(scale, anchor: anchor)
            .animation(pressed ? motion.press : motion.release, value: pressed)
            .onChange(of: pressed) { _, isPressed in
                if isPressed { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
            .onChange(of: touch) { _, touch in
                if pressed, let touch { anchor = PieceMotion.pressAnchor(touch: touch, in: size) }
            }
    }
}

private extension View {
    /// Sinks this view while `pressed`, leaning toward `touch` (in this view's coordinates) when given.
    func piecePress(_ pressed: Bool, touch: CGPoint? = nil, depth: CGFloat = 2.5) -> some View {
        modifier(PiecePress(pressed: pressed, touch: touch, depth: depth))
    }
}

// swiftpieces-motion: end

// MARK: - Piece liquid
//
// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of
// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only
// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the
// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.
// swiftpieces-liquid: 1.7.1 (liquid, liquidPress)

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

// swiftpieces-liquid: end
