// Address Field: type-ahead address suggestions that resolve to a structured, verified address. The emitter
// calls `AddressField(_:text:address:region:countries:allowsUnverified:)` exactly as
// registry/swift/inputs/AddressField.swift declares it. On device suggestions come from MapKit; the
// Playground searches a fixed set of sample addresses (SAMPLE_ADDRESSES) so it behaves the same offline.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num, str } from "../../core/swift.js";
import { bool, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const b = (p: Props, k: string) => p[k] === true;

export type SampleAddress = { street: string; city: string; state: string; postalCode: string; country: string; code: string };

/** The addresses the Playground's field searches. Fictional places, formatted the way each country writes them. */
export const SAMPLE_ADDRESSES: SampleAddress[] = [
  { street: "48 Juniper Lane", city: "Bellmont", state: "OR", postalCode: "97321", country: "United States", code: "US" },
  { street: "48 Juniper Court", city: "Ashford", state: "WA", postalCode: "98304", country: "United States", code: "US" },
  { street: "48 Junipero Street", city: "Alder Bay", state: "CA", postalCode: "94025", country: "United States", code: "US" },
  { street: "48 Juniper Row", city: "Harlow", state: "ON", postalCode: "L4K 2B9", country: "Canada", code: "CA" },
  { street: "90 Cedar Street", city: "Bellmont", state: "OR", postalCode: "97322", country: "United States", code: "US" },
  { street: "210 Maple Avenue", city: "Riverside Falls", state: "VT", postalCode: "05091", country: "United States", code: "US" },
  { street: "12 Harbour Row", city: "Kestrel Bay", state: "NS", postalCode: "B3K 1P4", country: "Canada", code: "CA" },
  { street: "7 Orchard Mews", city: "Linwood", state: "", postalCode: "LN4 7QX", country: "United Kingdom", code: "GB" },
  { street: "3 Almond Close", city: "Westbury", state: "", postalCode: "BA13 2PL", country: "United Kingdom", code: "GB" },
  { street: "15 Rue des Tilleuls", city: "Montclair-sur-Loire", state: "", postalCode: "45170", country: "France", code: "FR" },
];

/** The suggestion's second line, as MapKit writes it: locality, state, country. */
export const sampleSubtitle = (a: SampleAddress) => [a.city, a.state, a.country].filter(Boolean).join(", ");

/** The resolved field's second line, in the country's postal order, dropping the country at home (US). */
export function sampleLocality(a: SampleAddress): string {
  if (a.code === "US") return `${a.city} ${a.state} ${a.postalCode}`;
  if (a.code === "CA") return `${a.city} ${a.state} ${a.postalCode}, ${a.country}`;
  if (a.code === "FR") return `${a.postalCode} ${a.city}, ${a.country}`;
  return `${a.city}, ${a.postalCode}, ${a.country}`;
}

/** Upper-cased ISO codes from "US, ca". */
export function countryCodes(p: Props): string[] {
  return s(p, "countries").split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
}

/** Region bias presets: center and radius in meters. */
const REGIONS: Record<string, { lat: number; lon: number; meters: number } | null> = {
  none: null,
  portland: { lat: 45.515, lon: -122.679, meters: 60_000 },
  toronto: { lat: 43.653, lon: -79.383, meters: 60_000 },
  london: { lat: 51.507, lon: -0.128, meters: 40_000 },
};

export const definition: SwiftPieceDefinition = {
  id: "address-field",
  name: "Address Field",
  category: "pieces",
  description: "An address field with type-ahead suggestions. Pick one and it resolves into a verified address with street, city, postal code and country; the field settles into the street with the locality underneath and a check.",
  availability: "free",
  preview: { component: "address-field", chunk: "pieces-utility" },
  source: { registry: "free", name: "AddressField" },
  docs: "/docs/components/inputs/address-field",
  icon: "mappin",
  concepts: ["state", "binding", "textfield", "async", "struct", "import"],
  interactions: ["type", "tap", "select", "loading", "haptic", "transition"],
  properties: [
    text("label", "Placeholder", "Delivery address", { maxLength: 40 }),
    text("countries", "Countries", "US, CA", { maxLength: 60, hint: "ISO codes, comma separated. Addresses elsewhere are left out or refused. Empty accepts every country." }),
    select("region", "Search near", "none", opts(["none", "Anywhere"], ["portland", "Portland"], ["toronto", "Toronto"], ["london", "London"]), { hint: "Biases suggestions toward an area. Location permission is never asked for." }),
    bool("allowsUnverified", "Offer “Use as typed”", true, { hint: "When nothing matches or a lookup fails, the typed text can still be used, marked as not verified." }),
    select("phase", "Show", "empty", opts(["empty", "Empty"], ["suggestions", "Suggestions"], ["resolving", "Resolving"], ["resolved", "Resolved"], ["unverified", "Used as typed"], ["error", "Lookup failed"]), { group: "state", hint: "Where the Playground starts. On device the field moves through these as you type and pick." }),
    text("query", "Sample query", "48 Juni", { maxLength: 60, group: "state", hint: "Typed into the field for Suggestions, Resolving and Lookup failed." }),
  ],
  variants: [
    { id: "delivery", label: "Delivery", props: { label: "Delivery address", countries: "US, CA", region: "none", allowsUnverified: true, phase: "empty" } },
    { id: "saved", label: "Saved address", props: { label: "Billing address", countries: "", phase: "resolved" } },
    { id: "strict", label: "Verified only", props: { label: "Shipping address", countries: "US", allowsUnverified: false, region: "portland", phase: "suggestions" } },
  ],
  states: [
    { id: "empty", label: "Empty", props: { phase: "empty" } },
    { id: "suggestions", label: "Suggestions", props: { phase: "suggestions", query: "48 Juni" } },
    { id: "resolving", label: "Resolving", props: { phase: "resolving", query: "48 Juni" } },
    { id: "resolved", label: "Resolved", props: { phase: "resolved" } },
    { id: "unverified", label: "Used as typed", props: { phase: "unverified", query: "Flat 3, 12 Harbour Row" } },
    { id: "error", label: "Lookup failed", props: { phase: "error", query: "48 Juni" } },
  ],
  anatomy: [
    { part: "Field", props: ["label"] },
    { part: "Suggestions", props: ["region", "countries", "query"] },
    { part: "Resolution", props: ["allowsUnverified", "phase"] },
  ],
  swift: {
    imports: ["MapKit"],
    emit(p, ctx) {
      const phase = s(p, "phase");
      const typed = s(p, "query").trim() || "Flat 3, 12 Harbour Row";
      const sample = SAMPLE_ADDRESSES[0];
      // A resolved or used-as-typed state starts with that address; the field fills its own text from it.
      const initial =
        phase === "resolved"
          ? `AddressField.Address(street: ${str(sample.street)}, city: ${str(sample.city)}, state: ${str(sample.state)}, postalCode: ${str(sample.postalCode)}, country: ${str(sample.country)}, isoCountryCode: ${str(sample.code)})`
          : phase === "unverified"
            ? `AddressField.Address(formatted: ${str(typed)}, isVerified: false)`
            : "nil";
      const query = ctx.state("query", "String", phase === "unverified" ? str(typed) : '""');
      const address = ctx.state("address", "AddressField.Address?", initial);
      const region = REGIONS[s(p, "region")] ?? null;
      if (region) ctx.import("MapKit");
      const codes = countryCodes(p);
      return {
        lines: call("AddressField", [
          [null, str(s(p, "label") || "Address")],
          ["text", `$${query}`],
          ["address", `$${address}`],
          region && ["region", `MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: ${num(region.lat)}, longitude: ${num(region.lon)}), latitudinalMeters: ${num(region.meters)}, longitudinalMeters: ${num(region.meters)})`],
          codes.length > 0 && ["countries", `[${codes.map(str).join(", ")}]`],
          !b(p, "allowsUnverified") && ["allowsUnverified", "false"],
        ]),
      };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
