/**
 * The pricing card's ember cover (Pro and Games, the middle plan), the same on both sites: one fixed
 * seed, so pro.swiftpieces.com and swiftpieces.com show the identical field every time (2026-11-01,
 * Saivion: the pricing effect is one consistent piece, not a new take per page).
 *
 * The cover ships as a still painted by the grain engine itself (SwiftPiecesPro scripts/plan-cover.ts), in the server
 * HTML, so it is complete on the first frame: no CSS stand-in, no canvas arriving late or painted at
 * a mid-animation size. The still is drawn at the cover's desktop size; at any other size the stage
 * paints the same seed at the exact size before the frame shows (GrainStage's `still`).
 *
 * Copied from SwiftPiecesPro (lib/brand/plan-cover.ts and public/brand/plan-cover.webp), which makes the
 * still: keep both in step.
 */
import { EMBER_CORES } from "./grain";

export type GrainStill = {
  /** The painted still, at `width` x `height` CSS pixels, 2x. */
  src: string;
  width: number;
  height: number;
  /** A tiny blurred copy, inline, under the still while it decodes. */
  placeholder: string;
};

export const PLAN_COVER = {
  seed: "plans-everything",
  core: "copy",
  still: {
    src: "/brand/plan-cover.webp",
    width: 397,
    height: 246,
    placeholder:
      "data:image/webp;base64,UklGRnYCAABXRUJQVlA4WAoAAAAgAAAAFwAADgAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggiAAAAPAEAJ0BKhgADwA+tUyeSackoqEwCADgFolsAJ0yhHAizKuaAs3W2q4FwxyKejl8gAD4YCzNYC+E+7OFxzOYKwBNb7JrNYYsBm+1/42/8ZwaCSSeL6YrkqhVV9R11ekCtFNNoHpJxJfVhibhO9I82H64lKCBtZAVsGf3H9O7BGQ//uv5EpMAAAA=",
  },
} as const satisfies { seed: string; core: keyof typeof EMBER_CORES; still: GrainStill };
