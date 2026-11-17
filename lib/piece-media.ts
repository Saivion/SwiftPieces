// Each free component's own images (scripts/capture-previews.ts writes lib/piece-media.json): a 1200x900 still of
// its live preview in light and dark, a thumbnail for lists, and a share card. The component page is the
// still's one home: it shows it near the h1, names it as og:image and in JSON-LD, and the image sitemap lists it.
import media from "@/lib/piece-media.json";
import type { RegistryIndexEntry } from "@/lib/registry-schema";
import { piecePhrase } from "@/lib/piece-seo";

export type PieceMedia = { light: string; dark: string; thumb: string; og: string; width: number; height: number };

const byName = media as Record<string, PieceMedia>;

export function pieceImage(item: Pick<RegistryIndexEntry, "name">): PieceMedia | null {
  return byName[item.name] ?? null;
}

/** What the still shows, for its alt text: "Flip Card: SwiftUI 3D Flip Card for iOS, live preview in light mode". */
export function pieceImageAlt(item: Pick<RegistryIndexEntry, "name" | "title">, theme: "light" | "dark" = "light"): string {
  const phrase = piecePhrase(item);
  const what = phrase.toLowerCase() === item.title.toLowerCase() ? "SwiftUI component" : `SwiftUI ${phrase}`;
  return `${item.title}: ${what} for iOS, live preview in ${theme} mode`;
}
