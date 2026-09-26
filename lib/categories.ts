// Free catalog categories (Rev 5). One place for the id, docs slug, sidebar title, Xcode target
// folder and the one-line description. Pure data: safe to import from client components.
// Categories describe the design and interaction value of a piece, not the UI primitive it wraps.
export const categories = {
  text: { slug: "text", title: "Text", folder: "Text", description: "Type that reveals, expands and renders as glass." },
  backgrounds: { slug: "backgrounds", title: "Backgrounds", folder: "Backgrounds", description: "Quiet atmospheres: a Metal silk shader and a touch-reactive dot grid." },
  glass: { slug: "glass", title: "Glass", folder: "Glass", description: "Correct iOS 26 Liquid Glass with Material fallbacks." },
  controls: { slug: "controls", title: "Controls", folder: "Controls", description: "Buttons and dials with press depth, hold, drag and outcome states." },
  inputs: { slug: "inputs", title: "Inputs", folder: "Inputs", description: "Tracks, steppers, rails and fields built for the thumb." },
  cards: { slug: "cards", title: "Cards", folder: "Cards", description: "Cards with depth, motion, parallax and gesture-driven stacks." },
  lists: { slug: "lists", title: "Lists", folder: "Lists", description: "Rows and carousels with swipe, depth and completion physics." },
  navigation: { slug: "navigation", title: "Navigation", folder: "Navigation", description: "Floating docks, tracking tabs and stretchy headers." },
  sheets: { slug: "sheets", title: "Sheets", folder: "Sheets", description: "Toasts, confirmations and permission moments." },
  feedback: { slug: "feedback", title: "Feedback", folder: "Feedback", description: "Reactions, ratings, status morphs, skeletons and outcomes." },
  motion: { slug: "motion", title: "Motion", folder: "Motion", description: "Gesture modifiers with real physics." },
  data: { slug: "data", title: "Data", folder: "Data", description: "Scrubbable charts, rings, live stats and odometers." },
  ai: { slug: "ai", title: "AI", folder: "AI", description: "Streaming replies, thinking states, prompt chips and code." },
  media: { slug: "media", title: "Media", folder: "Media", description: "Photo viewing and story playback." },
} as const;

export type Category = keyof typeof categories;
export const categoryIds = Object.keys(categories) as [Category, ...Category[]];
export const categoryTitle = (id: string): string => (categories as Record<string, { title: string }>)[id]?.title ?? id;
