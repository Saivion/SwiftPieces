import type { Metadata } from "next";
import { OpenSaved } from "@/components/playground/open-saved";

/** Opens a saved remix (from the Pro account's Saved list) on the right app's playground. */
export const metadata: Metadata = { title: "Opening your remix", robots: { index: false, follow: false } };

export default function OpenSavedPage() {
  return <OpenSaved />;
}
