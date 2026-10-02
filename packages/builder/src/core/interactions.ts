// The interaction vocabulary. Every component names the interactions it responds to, every catalog
// entry names the ones it demonstrates, and the inspector explains each one in two lines: what it
// feels like, and which SwiftUI API makes it. One list, so the words never drift between pages.

export type InteractionId =
  | "tap" | "press" | "hold" | "swipe" | "drag" | "scrub" | "expand" | "toggle" | "select" | "type"
  | "scroll" | "pull" | "sheet" | "push" | "tabs" | "menu" | "spring" | "loading" | "haptic" | "transition" | "stream";

export type Interaction = {
  id: InteractionId;
  name: string;
  /** What you do, in one short line. */
  gesture: string;
  /** What to notice while doing it. */
  feel: string;
  /** The SwiftUI APIs behind it, as they appear in code. */
  swiftui: string[];
};

export const interactions: Interaction[] = [
  { id: "tap", name: "Tap", gesture: "Tap it.", feel: "A tap acts on release, so dragging off cancels it.", swiftui: ["Button", "onTapGesture"] },
  { id: "press", name: "Press", gesture: "Press and release.", feel: "The control dips while your finger is down and springs back on release.", swiftui: ["ButtonStyle", "configuration.isPressed", "scaleEffect"] },
  { id: "hold", name: "Hold", gesture: "Press and keep holding.", feel: "Progress fills while you hold; letting go early rewinds it.", swiftui: ["onLongPressGesture(minimumDuration:)", "withAnimation"] },
  { id: "swipe", name: "Swipe", gesture: "Flick it sideways.", feel: "It follows your finger, then commits or springs home based on distance and speed.", swiftui: ["DragGesture", "offset", "rotationEffect"] },
  { id: "drag", name: "Drag", gesture: "Grab it and move.", feel: "It tracks 1:1 under your finger and settles with a spring when released.", swiftui: ["DragGesture", "GestureState"] },
  { id: "scrub", name: "Scrub", gesture: "Slide across it.", feel: "Values change continuously under your finger, with a tick at each step.", swiftui: ["DragGesture(minimumDistance: 0)", "sensoryFeedback(.selection)"] },
  { id: "expand", name: "Expand", gesture: "Tap to open it up.", feel: "Content grows in place; the layout around it moves out of the way.", swiftui: ["withAnimation", "matchedGeometryEffect", "DisclosureGroup"] },
  { id: "toggle", name: "Toggle", gesture: "Flip it.", feel: "The state changes at once and the control animates to match.", swiftui: ["Toggle", "@State"] },
  { id: "select", name: "Select", gesture: "Pick one option.", feel: "The selection moves between options instead of blinking.", swiftui: ["Picker", "matchedGeometryEffect"] },
  { id: "type", name: "Type", gesture: "Tap in and type.", feel: "The field focuses, shows its keyboard type and reacts as you type.", swiftui: ["TextField", "@FocusState", "keyboardType"] },
  { id: "scroll", name: "Scroll", gesture: "Scroll the content.", feel: "Content moves with momentum; headers and bars react to the offset.", swiftui: ["ScrollView", "onScrollGeometryChange", "scrollTransition"] },
  { id: "pull", name: "Pull", gesture: "Pull past the edge.", feel: "The edge stretches, then snaps back once you let go.", swiftui: ["refreshable", "onScrollGeometryChange"] },
  { id: "sheet", name: "Sheet", gesture: "Open it, then drag it down.", feel: "The sheet rises over the screen, rests at its detents and follows your drag to dismiss.", swiftui: ["sheet(isPresented:)", "presentationDetents"] },
  { id: "push", name: "Push", gesture: "Tap to go deeper.", feel: "The next screen slides in from the trailing edge; back slides it away.", swiftui: ["NavigationStack", "NavigationLink", "dismiss"] },
  { id: "tabs", name: "Tabs", gesture: "Switch tabs.", feel: "Each tab keeps its own place, so switching back returns you where you were.", swiftui: ["TabView", "tabItem"] },
  { id: "menu", name: "Menu", gesture: "Tap to open the menu.", feel: "Options bloom from the control and dismiss when you choose or tap away.", swiftui: ["Menu", "contextMenu"] },
  { id: "spring", name: "Spring", gesture: "Watch it settle.", feel: "Motion overshoots slightly and settles, the way physical things do.", swiftui: [".spring(response:dampingFraction:)", ".bouncy", ".snappy"] },
  { id: "loading", name: "Loading", gesture: "Start the action.", feel: "The control shows progress in place, then resolves to success or an error.", swiftui: ["ProgressView", "task", "contentTransition"] },
  { id: "haptic", name: "Haptic", gesture: "Feel it commit.", feel: "A short tap of vibration confirms the moment something happens.", swiftui: ["sensoryFeedback", "UIImpactFeedbackGenerator"] },
  { id: "transition", name: "Transition", gesture: "Change the state.", feel: "Views enter and leave with a transition instead of popping in.", swiftui: ["transition", "contentTransition", "matchedGeometryEffect"] },
  { id: "stream", name: "Stream", gesture: "Watch it arrive.", feel: "Text and states appear progressively, so waiting reads as progress.", swiftui: ["AsyncStream", "contentTransition(.opacity)", "phaseAnimator"] },
];

const byId = new Map(interactions.map((i) => [i.id, i]));
export const interactionById = (id: string): Interaction | undefined => byId.get(id as InteractionId);
