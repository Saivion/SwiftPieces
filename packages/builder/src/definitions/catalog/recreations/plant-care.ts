// The plant-care recreation: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in plant-care.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "plant-care", title: "Plant Care", category: "Lifestyle",
    summary: "Your plants by room as drawn collages, a plant's care at a glance, a camera to identify, a check-up for leaves that look off, a light meter and a community, on a floating dock.",
    description: "A plant care app in six screens across three tabs on a floating dock, in the SwiftPieces look, light or dark, with every plant drawn: your rooms as collages of their plants on house pastels, with tabs that swap to every plant in a list; one plant under its large title, its picture in pages you swipe, its room and health as chips, two care rings side by side and today's tasks; a camera sheet framing a plant whose Leaf, Whole plant and Flower modes each bring their own hint; a check-up led by a picture of the job, one squashy button and common signs as drawn leaves that each start one, over an empty state for past check-ups; a light meter you steer by pointing the camera at a sunny window; and a community with your groups as drawn circles over a post with its photo. Shape lock: actions are pills, cards 24, tiles 16. Built from Screen Header, Tracking Tabs, Photo Mosaic, Media Row, Page Carousel, Tag, Timer Dial, Task Row, Commit Button, Tint Panel, Camera Viewfinder, Image, Elastic Button, Avatar, Reaction Toggle and Swipe Action Row.",
    try: ["Tap plus, then swipe between Leaf, Whole plant and Flower", "Swipe from Rooms to Plants, then open a plant", "Swipe the plant's pictures, then mark all three done", "Tap the sun and drag across the light meter", "Start a check-up, or tap a common sign", "Swipe between Feed and Saved"],
    interactions: ["tabs", "tap", "drag", "swipe", "press", "push", "sheet", "select", "loading", "spring", "haptic"],
    components: ["screen-header", "tracking-tabs", "photo-mosaic", "media-row", "page-carousel", "tag", "timer-dial", "task-row", "commit-button", "tint-panel", "camera-viewfinder", "image", "elastic-button", "avatar", "reaction-toggle", "swipe-action-row"],
    keywords: ["swiftui plant app", "swiftui camera viewfinder", "swiftui photo collage", "swiftui light meter"],
    steps: [
      { title: "Rooms", transition: "start" },
      { title: "A plant", transition: "push" },
      { title: "Identify", transition: "sheet", note: ".sheet(isPresented:) with a camera view" },
      { title: "Check-up", transition: "tab" },
      { title: "Light meter", transition: "sheet" },
      { title: "Community", transition: "tab" },
    ],
  },
  moves: [
    ["Each room is a collage of its own plants, drawn, so you find a plant by where it lives; tabs swap the rooms for every plant in one list.", "What's due shows as a red badge on the room; the header plus identifies a new plant."],
    ["A pushed plant keeps the system large title and back, with the light check in the bar; its picture leads in pages you swipe, its room and health sit under it as chips.", "Two care rings side by side say how soon each routine is due; tick tasks one by one, or mark them all done in one go with a success tap."],
    ["The camera fills the sheet under a titled header with a close button, a plant in its corners; Leaf, Whole plant and Flower along the shutter bar each bring their own hint."],
    ["One job up front: a picture of it, one sentence and a squashy button; common signs sit below as drawn leaves, two by two, each with its likely cause, and each starts a check-up.", "Past check-ups start as a composed empty state that says what will land there."],
    ["The reading is the screen. Drag across the window as if turning the camera and it steps between levels, the scale below following in red."],
    ["Your groups lead as drawn circles over the feed, a post with its photo; feed and saved are tracking tabs you swipe between, likes flood with colour and saved threads swipe to pin or delete."],
  ],
};
