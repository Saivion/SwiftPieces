import MapKit
import SwiftUI

/// The CheckoutBlock recording scene (PreviewCatalog): a coffee shop's bag as it sits in a screen, with addresses from a
/// small fixed list so it records offline, and a payment that goes through after 1.2s.
struct CheckoutBlockScene: View {
    @State private var checkout = CheckoutBlockSceneSample.checkout

    var body: some View {
        ScrollView {
            CheckoutBlock(checkout: $checkout, countries: ["US"], addressSource: CheckoutBlockSceneSample.addresses) { _ in
                try await Task.sleep(for: .seconds(1.2))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .background(CheckoutBlockSceneSample.ground.ignoresSafeArea())
    }
}

private enum CheckoutBlockSceneSample {
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
        payment: CheckoutBlock.PaymentMethod(title: "Visa ending 4242", detail: "Expires 08/28", kind: .card),
        currencyCode: "USD"
    )

    static let address = AddressField.Address(
        street: "48 Juniper Lane", city: "Bellmont", state: "OR", postalCode: "97321", country: "United States", isoCountryCode: "US",
        coordinate: CLLocationCoordinate2D(latitude: 44.6, longitude: -123.1)
    )

    static var addresses: AddressField.Source {
        AddressField.Source(
            suggest: { query in
                try await Task.sleep(for: .milliseconds(350))
                return [
                    AddressField.Suggestion(id: "juniper", title: "48 Juniper Lane", subtitle: "Bellmont, OR, United States"),
                    AddressField.Suggestion(id: "juniper-ct", title: "48 Juniper Court", subtitle: "Ashford, WA, United States"),
                ].filter { $0.title.localizedCaseInsensitiveContains(query) }
            },
            resolve: { suggestion in
                try await Task.sleep(for: .milliseconds(600))
                guard suggestion.id != "juniper" else { return address }
                return AddressField.Address(street: suggestion.title, city: "Ashford", state: "WA", country: "United States", isoCountryCode: "US")
            }
        )
    }

    /// The house ground behind the block, light and dark.
    static let ground = Color(uiColor: UIColor { @Sendable traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x12 / 255, green: 0x12 / 255, blue: 0x12 / 255, alpha: 1)
            : UIColor(red: 0xF3 / 255, green: 0xF2 / 255, blue: 0xEE / 255, alpha: 1)
    })
}
