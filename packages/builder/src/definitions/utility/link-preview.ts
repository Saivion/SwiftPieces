// Link Preview: a rich card for a URL, fetched with LinkPresentation and cached. The emitter calls
// `LinkPreview(url:layout:metadata:timeout:style:)` exactly as registry/swift/media/LinkPreview.swift
// declares it. On device the card fetches the real page; the Playground shows the sample title instead.
import type { Props, SwiftPieceDefinition } from "../../core/schema.js";
import { call, num, str } from "../../core/swift.js";
import { bool, number, opts, select, text } from "../shared.js";

const s = (p: Props, k: string) => String(p[k] ?? "");
const n = (p: Props, k: string) => Number(p[k] ?? 0);
const b = (p: Props, k: string) => p[k] === true;

/** The URL as typed, or a safe sample when it is empty or not a URL, so the generated code always builds and runs. */
export function linkPreviewURL(p: Props): string {
  const raw = s(p, "url").trim();
  return /^[a-z][a-z0-9+.-]*:\S+$/i.test(raw) ? raw : "https://fieldnotes.travel/lisbon-tram-28";
}

export const definition: SwiftPieceDefinition = {
  id: "link-preview",
  name: "Link Preview",
  category: "pieces",
  description: "A rich card for a link: the page's image, title and site, fetched once and cached. It holds its size while it loads, falls back to the address when a page can't be read, opens on tap and offers Copy Link and Share on long press.",
  availability: "free",
  preview: { component: "link-preview", chunk: "pieces-utility" },
  source: { registry: "free", name: "LinkPreview" },
  docs: "/docs/components/media/link-preview",
  icon: "link",
  concepts: ["async", "struct", "enum", "button"],
  interactions: ["tap", "hold", "menu", "loading", "haptic", "transition"],
  properties: [
    text("url", "Link", "https://fieldnotes.travel/lisbon-tram-28", { maxLength: 200, hint: "Web links are fetched on device. Email and phone links show the address card." }),
    select("layout", "Layout", "large", opts(["large", "Large (image on top)"], ["compact", "Compact (row)"])),
    text("title", "Sample title", "Twelve stops on the old tram line through Lisbon", { maxLength: 120, hint: "What the Playground shows. On device the card fetches the page's real title." }),
    bool("image", "Page has an image", true, { hint: "Without one, the card shows the site's first letter on a color block." }),
    bool("supplied", "Use the sample as metadata", false, { hint: "Writes the title into the code, so the card shows it without fetching. For previews and links you already unfurled." }),
    select("phase", "Show", "loaded", opts(["loaded", "Loaded"], ["loading", "Loading"], ["fallback", "Address card"]), { group: "state", hint: "How the Playground shows it. On device the card goes through these by itself." }),
    number("timeout", "Timeout (s)", 15, 3, 60, 1, { level: "advanced", group: "interaction" }),
    number("cornerRadius", "Corner radius", 18, 8, 34, 1, { level: "advanced", group: "layout" }),
  ],
  variants: [
    { id: "article", label: "Article", props: { url: "https://fieldnotes.travel/lisbon-tram-28", layout: "large", title: "Twelve stops on the old tram line through Lisbon", image: true } },
    { id: "chat", label: "In a chat", props: { url: "https://slowdesk.co/notes/quiet-mornings", layout: "compact", title: "Quiet mornings: a note-taking routine that sticks", image: false } },
    { id: "email", label: "Email link", props: { url: "mailto:hello@slowdesk.co", layout: "compact" } },
  ],
  states: [
    { id: "loading", label: "Loading", props: { phase: "loading" } },
    { id: "loaded", label: "Loaded", props: { phase: "loaded", image: true } },
    { id: "no-image", label: "No image", props: { phase: "loaded", image: false } },
    { id: "fallback", label: "Can't be read", props: { phase: "fallback" } },
  ],
  anatomy: [
    { part: "Link", props: ["url", "supplied"] },
    { part: "Card", props: ["layout", "cornerRadius"] },
    { part: "Content", props: ["title", "image"] },
    { part: "Loading", props: ["phase", "timeout"] },
  ],
  swift: {
    imports: [],
    emit(p) {
      const title = s(p, "title").trim();
      const radius = n(p, "cornerRadius");
      const timeout = n(p, "timeout");
      const lines = call("LinkPreview", [
        ["url", `URL(string: ${str(linkPreviewURL(p))})!`],
        s(p, "layout") === "large" && ["layout", ".large"],
        b(p, "supplied") && title !== "" && ["metadata", `.init(title: ${str(title)})`],
        timeout > 0 && timeout !== 15 && ["timeout", num(timeout)],
        radius > 0 && radius !== 18 && ["style", `.init(cornerRadius: ${num(radius)})`],
      ]);
      return { lines };
    },
  },
};

/** Whether it takes all the width it is offered (see react/preview/fills.ts). */
export const fill = true;
