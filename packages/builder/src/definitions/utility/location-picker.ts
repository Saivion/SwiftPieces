// Location Picker: a map you drag under a fixed red pin, with the address of wherever the pin settles in a
// floating card, a locate-me button and a red Confirm. The emitter calls
// `LocationPicker(selection:initialCenter:span:showsLocationButton:messages:style:onConfirm:)` exactly as
// registry/swift/inputs/LocationPicker.swift declares it, writing only what differs from its defaults, and
// holds the place in a `@State` the screen owns. On device the map and addresses come from MapKit; the
// Playground draws a fictional town (LP_TOWN) and names its streets, so it behaves the same offline. A map
// that starts in Lisbon wears a Lisbon quarter's names (LP_LISBON) on the same streets.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { INDENT, call, modifiers, num, str } from "../../core/swift.js";
import { bool, link, linkStatement, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;
/** Degrees to four places (about 10 m), which `num` would round to three. */
const degrees = (v: number) => String(Math.round(v * 10_000) / 10_000);

/** Swift defaults, so the emitted call only spells out what differs. */
export const LP_DEFAULTS = { span: 500, confirm: "Confirm location", height: 420 } as const;

/** Where the map can start. `here` is the Swift default: the person's location when allowed, else central Lisbon. */
export const LP_STARTS: Record<string, { label: string; lat: number; lon: number } | null> = {
  here: null,
  lisbon: { label: "Lisbon", lat: 38.7105, lon: -9.1366 },
  london: { label: "London", lat: 51.5072, lon: -0.1276 },
  newYork: { label: "New York", lat: 40.7411, lon: -73.9897 },
  tokyo: { label: "Tokyo", lat: 35.6595, lon: 139.7005 },
};

// ---------------------------------------------------------------- The Playground's town

/**
 * Bellmont, the fictional town the Playground's map draws, in points with the person's location at the
 * origin on Maple Avenue. Roads run every `grid` points: east-west roads at y = j * grid, north-south
 * roads at x = offsetX + i * grid. A park fills the block north-east of the person; a bay lies north-west.
 */
export const LP_TOWN = {
  grid: 110,
  offsetX: -40,
  eastWest: ["Ridge Road", "Harbor Road", "Maple Avenue", "Linden Street", "Orchard Street", "Willow Street"],
  /** Index of Maple Avenue (j = 0) in `eastWest`. */
  eastWestZero: 2,
  northSouth: ["Pine Street", "Cedar Street", "Birch Street", "Juniper Lane", "Alder Street", "Elm Street", "Aspen Way"],
  /** Index of Birch Street (i = 0) in `northSouth`. */
  northSouthZero: 2,
  park: { x0: 70, y0: -110, x1: 180, y1: 0, name: "Juniper Park" },
  bay: { cx: -360, cy: -380, rx: 330, ry: 300 },
  locality: "Bellmont OR 97321",
} as const;

/**
 * The names the Playground's town wears. The streets, the park and the bay stay where LP_TOWN draws them;
 * only what they're called, how an address reads and where the coordinates sit change with the place.
 */
export type LpNames = {
  eastWest: readonly string[];
  eastWestZero: number;
  northSouth: readonly string[];
  northSouthZero: number;
  park: string;
  locality: string;
  /** The person's spot, and degrees of longitude per point (about 1.3 m) at that latitude. */
  lat: number;
  lon: number;
  lonPerPoint: number;
  /** The address line for a house number on a street, in the place's own order and numbering. */
  address: (number: number, street: string) => string;
  /** A street as the map labels it: capitals, shortened. */
  label: (street: string) => string;
  /** What "Show places" names its four places, in drawing order. */
  places: readonly [string, string, string, string];
};

/** Bellmont, Oregon: the default town. */
export const LP_BELLMONT: LpNames = {
  eastWest: LP_TOWN.eastWest,
  eastWestZero: LP_TOWN.eastWestZero,
  northSouth: LP_TOWN.northSouth,
  northSouthZero: LP_TOWN.northSouthZero,
  park: LP_TOWN.park.name,
  locality: LP_TOWN.locality,
  lat: 44.6105,
  lon: -123.117,
  lonPerPoint: 0.0000162,
  address: (number, street) => `${number} ${street}`,
  label: (street) => street.toUpperCase().replace("AVENUE", "AVE").replace("STREET", "ST").replace("ROAD", "RD").replace("LANE", "LN").replace("WAY", "WY"),
  places: ["Fern Café", "Bellmont Library", "Maple Ave Station", "Linden Pharmacy"],
};

/** A Lisbon quarter, for maps that start in Lisbon: street first, then a short house number. */
export const LP_LISBON: LpNames = {
  eastWest: ["Rua das Escadinhas", "Rua da Maré", "Avenida do Tejo", "Rua dos Telhados", "Rua da Fonte", "Rua do Vento"],
  eastWestZero: 2,
  northSouth: ["Travessa da Luz", "Calçada do Castelo", "Rua de São Brás", "Beco das Laranjeiras", "Rua da Graça", "Escadinhas do Mirante", "Rua Nova"],
  northSouthZero: 2,
  park: "Jardim do Miradouro",
  locality: "1100-312 Lisboa",
  lat: 38.7105,
  lon: -9.1366,
  lonPerPoint: 0.000015,
  address: (number, street) => `${street}, ${Math.max(1, Math.round(number / 8))}`,
  // Portuguese maps shorten the street type in front: R. for Rua, Av. for Avenida.
  label: (street) => street.toUpperCase().replace(/^(RUA|AVENIDA|TRAVESSA|CALÇADA|ESCADINHAS|BECO) /, (_, t: string) => `${({ RUA: "R.", AVENIDA: "AV.", TRAVESSA: "TV.", CALÇADA: "CÇ.", ESCADINHAS: "ESC.", BECO: "BC." } as Record<string, string>)[t]} `),
  places: ["Café da Esquina", "Biblioteca do Bairro", "Paragem do Elétrico", "Farmácia da Graça"],
};

/** The names for where the map starts: Lisbon's for Lisbon, Bellmont's everywhere else. */
export const lpNames = (start: string): LpNames => (start === "lisbon" ? LP_LISBON : LP_BELLMONT);

const wrap = (list: readonly string[], k: number) => list[((k % list.length) + list.length) % list.length];
export const lpEastWest = (j: number, names: LpNames = LP_BELLMONT) => wrap(names.eastWest, names.eastWestZero + j);
export const lpNorthSouth = (i: number, names: LpNames = LP_BELLMONT) => wrap(names.northSouth, names.northSouthZero + i);
export const lpInBay = (x: number, y: number) => ((x - LP_TOWN.bay.cx) / LP_TOWN.bay.rx) ** 2 + ((y - LP_TOWN.bay.cy) / LP_TOWN.bay.ry) ** 2 < 1;

/** "44.6105° N, 123.1170° W" for a point in the town, about 1.3 m per point at street level. */
export function lpCoordinate(x: number, y: number, names: LpNames = LP_BELLMONT): string {
  const lat = names.lat - y * 0.0000115;
  const lon = names.lon + x * names.lonPerPoint;
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}

/**
 * What the geocoder answers for a point: the nearest street with a house number (even on the north and
 * west sides), the park's name inside the park, and no address on the water.
 */
export function lpPlaceAt(x: number, y: number, names: LpNames = LP_BELLMONT): { title: string | null; subtitle: string } {
  const { grid, offsetX, park } = LP_TOWN;
  if (lpInBay(x, y)) return { title: null, subtitle: lpCoordinate(x, y, names) };
  if (x > park.x0 + 8 && x < park.x1 - 8 && y > park.y0 + 8 && y < park.y1 - 8) return { title: names.park, subtitle: names.locality };
  const j = Math.round(y / grid);
  const i = Math.round((x - offsetX) / grid);
  const toEastWest = Math.abs(y - j * grid);
  const toNorthSouth = Math.abs(x - (offsetX + i * grid));
  if (toEastWest <= toNorthSouth) {
    const number = Math.max(2, 210 + Math.round(x / 4) * 2 + (y > j * grid ? 1 : 0));
    return { title: names.address(number, lpEastWest(j, names)), subtitle: names.locality };
  }
  const number = Math.max(2, 48 + Math.round(y / 4) * 2 + (x > offsetX + i * grid ? 1 : 0));
  return { title: names.address(number, lpNorthSouth(i, names)), subtitle: names.locality };
}

// ---------------------------------------------------------------- Definition

export const definition: SwiftPieceDefinition = {
  id: "location-picker",
  name: "Location Picker",
  category: "pieces",
  description: "Drag the map under a fixed red pin to choose an exact spot. The pin lifts while the map moves and drops when it settles; the card names the street there, or shows the coordinates when there's no address, and Confirm hands back the place.",
  availability: "free",
  preview: { component: "location-picker", chunk: "pieces-utility" },
  source: { registry: "free", name: "LocationPicker" },
  docs: "/docs/components/inputs/location-picker",
  icon: "map",
  concepts: ["state", "binding", "closure", "async", "struct", "import"],
  interactions: ["drag", "tap", "loading", "spring", "haptic", "transition"],
  properties: [
    select("start", "Starts at", "here", opts(["here", "Where you are, else Lisbon"], ["lisbon", "Lisbon"], ["london", "London"], ["newYork", "New York"], ["tokyo", "Tokyo"]), {
      hint: "Where the map opens. A saved place in the selection opens there instead.",
    }),
    number("span", "Zoom (meters across)", LP_DEFAULTS.span, 150, 5000, 50, { group: "layout", hint: "How much map shows around the pin at first." }),
    bool("confirm", "Confirm button", true, { group: "interaction", hint: "Off for a picker inside your own form, which reads the selection." }),
    text("confirmTitle", "Button text", LP_DEFAULTS.confirm, { maxLength: 32, when: { prop: "confirm", equals: [true] } }),
    link("link", "After confirm", { when: { prop: "confirm", equals: [true] } }),
    bool("locationButton", "Locate button", true, { group: "interaction", hint: "Asks for location the first time it's tapped, never before." }),
    bool("pointsOfInterest", "Show places", false, { group: "color", hint: "Shops, stations and landmarks on the map. Off keeps the streets and the pin first." }),
    bool("muted", "Muted map", true, { group: "color", level: "advanced" }),
    number("height", "Height", LP_DEFAULTS.height, 320, 760, 10, { group: "layout" }),
    select("simulate", "Preview as", "found", opts(["found", "Address found"], ["moving", "Map moving"], ["finding", "Finding the address"], ["unnamed", "No address"], ["failed", "Lookup failed"], ["denied", "Location off"]), {
      group: "state",
      hint: "Only for this preview. On device the picker moves through these as the map moves.",
    }),
  ],
  variants: [
    { id: "delivery", label: "Delivery drop-off", props: { start: "here", span: 500, confirm: true, confirmTitle: "Deliver here", locationButton: true, height: 420, simulate: "found" } },
    { id: "pickup", label: "Ride pickup", props: { start: "lisbon", span: 300, confirm: true, confirmTitle: "Confirm pickup", locationButton: true, height: 480, simulate: "found" } },
    { id: "form", label: "Inside a form", props: { start: "london", span: 800, confirm: false, locationButton: false, height: 320, simulate: "found" } },
  ],
  states: [
    { id: "found", label: "Address found", props: { simulate: "found" } },
    { id: "moving", label: "Map moving", props: { simulate: "moving" } },
    { id: "finding", label: "Finding the address", props: { simulate: "finding" } },
    { id: "unnamed", label: "No address", props: { simulate: "unnamed" } },
    { id: "failed", label: "Lookup failed", props: { simulate: "failed" } },
    { id: "denied", label: "Location off", props: { simulate: "denied" } },
  ],
  anatomy: [
    { part: "Map", props: ["start", "span", "pointsOfInterest", "muted", "height"] },
    { part: "Address card", props: ["simulate"] },
    { part: "Confirm", props: ["confirm", "confirmTitle", "link"] },
    { part: "Locate button", props: ["locationButton"] },
  ],
  swift: {
    imports: ["MapKit"],
    emit(p, ctx) {
      const place = ctx.state("place", "LocationPicker.Place?", "nil");
      const start = LP_STARTS[s(p, "start")] ?? null;
      if (start) ctx.import("MapKit");
      const span = Math.round(n(p, "span") || LP_DEFAULTS.span);
      const title = s(p, "confirmTitle").trim();
      const confirm = b(p, "confirm");
      const style = [
        // A Playground Style accent reaches the pin and Confirm, as the house red does by default.
        ctx.theme && "pin: Theme.accent",
        ctx.theme && "confirm: Theme.accent",
        ctx.theme && "confirmInk: Theme.accentInk",
        b(p, "pointsOfInterest") && "showsPointsOfInterest: true",
        p.muted === false && "mutesMap: false",
      ].filter(Boolean) as string[];
      const lines = call("LocationPicker", [
        ["selection", `$${place}`],
        start && ["initialCenter", `CLLocationCoordinate2D(latitude: ${degrees(start.lat)}, longitude: ${degrees(start.lon)})`],
        span !== LP_DEFAULTS.span && ["span", num(span)],
        !b(p, "locationButton") && ["showsLocationButton", "false"],
        confirm && title && title !== LP_DEFAULTS.confirm && ["messages", `.init(confirm: ${str(title)})`],
        style.length > 0 && ["style", `.init(${style.join(", ")})`],
      ]);
      if (confirm) {
        const then = linkStatement(ctx, p.link);
        // The trailing closure is `onConfirm`; it receives the place with its address once found.
        lines[lines.length - 1] += then ? " { _ in" : " { place in";
        lines.push(
          ...(then
            ? [`${INDENT}// The spot is in \`${place}\`: its coordinate, and its address once found.`, `${INDENT}${then}`]
            : [`${INDENT}// Save the spot: place.coordinate, and place.formatted once its address is known.`, `${INDENT}print("Picked", place.formatted ?? "a dropped pin")`]),
          "}",
        );
      }
      return {
        lines: modifiers(lines, [
          `frame(height: ${num(Math.round(n(p, "height") || LP_DEFAULTS.height))})`,
          `clipShape(.rect(cornerRadius: ${num(ctx.corner(26))}, style: .continuous))`,
        ]),
      };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
