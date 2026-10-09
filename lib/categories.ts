// Free catalog categories (Rev 5). One place for the id, docs slug, sidebar title, Xcode target
// folder and the one-line description. Pure data: safe to import from client components.
// Categories describe the design and interaction value of a piece, not the UI primitive it wraps.
export const categories = {
  text: { slug: "text", title: "Text", folder: "Text", description: "Type that reveals, expands, holds pictures and renders as glass." },
  backgrounds: { slug: "backgrounds", title: "Backgrounds", folder: "Backgrounds", description: "Quiet atmospheres: a Metal silk shader and a touch-reactive dot grid." },
  glass: { slug: "glass", title: "Glass", folder: "Glass", description: "Correct iOS 26 Liquid Glass with Material fallbacks." },
  controls: { slug: "controls", title: "Controls", folder: "Controls", description: "Buttons and dials with press depth, hold, drag and outcome states." },
  inputs: { slug: "inputs", title: "Inputs", folder: "Inputs", description: "Tracks, steppers, rails and fields built for the thumb, down to addresses, map pins and signatures." },
  cards: { slug: "cards", title: "Cards", folder: "Cards", description: "Cards with depth, motion, parallax and gesture-driven stacks." },
  lists: { slug: "lists", title: "Lists", folder: "Lists", description: "Rows, grids and carousels with swipe, drag-to-select, follow-the-latest and completion physics." },
  navigation: { slug: "navigation", title: "Navigation", folder: "Navigation", description: "Floating docks, tracking tabs, stretchy headers and an A to Z index." },
  sheets: { slug: "sheets", title: "Sheets", folder: "Sheets", description: "Toasts, confirmations, permission moments and guided tours." },
  feedback: { slug: "feedback", title: "Feedback", folder: "Feedback", description: "Reactions, ratings, status morphs, skeletons and outcomes." },
  motion: { slug: "motion", title: "Motion", folder: "Motion", description: "Gesture modifiers with real physics." },
  data: { slug: "data", title: "Data", folder: "Data", description: "Scrubbable charts, rings, streak heatmaps, live stats and odometers." },
  ai: { slug: "ai", title: "AI", folder: "AI", description: "Streaming replies, thinking states, prompt chips and answer sources." },
  media: { slug: "media", title: "Media", folder: "Media", description: "Photo viewing and cropping, story playback, attachments and link previews." },
} as const;

export type Category = keyof typeof categories;
export const categoryIds = Object.keys(categories) as [Category, ...Category[]];
export const categoryTitle = (id: string): string => (categories as Record<string, { title: string }>)[id]?.title ?? id;
