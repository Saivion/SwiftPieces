// The wine-ratings remix: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in wine-ratings.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "wine-ratings", title: "Wine Ratings", category: "Food & Drink",
    summary: "A wine app in the SwiftPieces look: a shop of offers picked for you, a label scanner, a wine's page with its rating, your match and its taste, a rating sheet, food pairings, your taste profile by style and a cellar with drinking windows.",
    description: "A wine app in seven screens across three tabs on a floating dock, in the SwiftPieces look; actions are capsules, cards 28, chips 12, bottles drawn tall. The shop opens on offers picked for you: a bottle with its deal in amber, its stars in claret and an add to cart that confirms as a toast, then friends' favourites as rows you add with one tap. Scan is the camera, with Wine label and Wine list modes that each bring their own hint; the shutter lands on the wine. A wine stands on a berry ground with the winery in capitals, its rating and its bottle, then how well it matches your taste as a ring, a raised Rate and a claret buy pill, its taste as sliders between poles with flavour chips, and the dishes it goes with, which open pairings from your own cellar. Rating is a sheet of stars you drag in half steps, a review, where you drank it and a badge earned as a toast. My Wines charts what you drink by style with each style in its own colour, then styles, regions and grapes as swipeable tabs; the cellar counts bottles, charts drinking windows by year and marks what's ready. Built from Screen Header, Search Field, Filter Rail, Image, Tag, Toast, Media Row, Elastic Button, Camera Viewfinder, Tint Panel, Goal Ring, Slider, Icon Toggles, Button, Stat Grid, Glass Bar, Avatar, Rating Scrub, Input, Toggle, Glass Segments, Category Bars, Tracking Tabs, Progress, Chart and Scrub Stepper.",
    try: ["Add the Ombralunga offer to your cart", "Switch the scanner to Wine list and read the hint", "Take the photo and read your match", "Nudge the taste sliders and tap a flavour", "Rate it four and a half and save for the badge", "Swipe My Wines from Styles to Grapes, then open the cellar"],
    interactions: ["tabs", "push", "sheet", "tap", "drag", "swipe", "select", "toggle", "type", "press", "haptic"],
    components: ["screen-header", "search-field", "filter-rail", "image", "tag", "toast", "media-row", "elastic-button", "camera-viewfinder", "tint-panel", "goal-ring", "slider", "icon-toggles", "button", "stat-grid", "glass-bar", "avatar", "rating-scrub", "input", "toggle", "glass-segments", "category-bars", "tracking-tabs", "progress", "chart", "scrub-stepper"],
    keywords: ["swiftui wine app", "swiftui label scanner", "swiftui taste profile", "swiftui rating sheet"],
    steps: [
      { title: "Shop", transition: "start" },
      { title: "Scan a label", transition: "tab", note: "A camera view with two scanning modes" },
      { title: "A wine", transition: "push" },
      { title: "Rate it", transition: "sheet" },
      { title: "Food pairings", transition: "push" },
      { title: "Taste profile", transition: "tab" },
      { title: "Cellar", transition: "push" },
    ],
  },
  moves: [
    ["The shop leads with one offer picked for you: the bottle, the deal in amber, the stars in claret and the price that matters, struck against the old one.", "Add to cart confirms as a toast with an undo; friends' favourites sit below as rows you add with a tap."],
    ["The camera is the screen: corners to fill and one hint, and Wine label and Wine list each bring their own.", "The shutter goes straight to the wine it found."],
    ["The wine stands on a berry ground, the colour of what's in the glass, with the winery in capitals over the name and the rating beside the bottle.", "How well it suits you is a ring, not a footnote; taste reads as sliders between two poles, and the dishes it goes with lead to pairings."],
    ["Rating is one gesture: drag across the stars in half steps and the score and its word follow.", "Saving can earn a badge, which arrives as a toast."],
    ["A dish opens on its picture, then the best bottle you already own on a blush card before anything you'd buy.", "One line says why the style works, and the rows below add to the cart."],
    ["What you drink is one bar per style, each in its own colour, so the shape of your taste is a glance.", "Styles, regions and grapes are tabs you swipe, each with how much of the map you've tried."],
    ["The cellar counts bottles, what's ready and what it's worth, then drinking windows by year as bars.", "Each bottle says Drink now in green or Hold in amber; the stepper scrubs how many are left."],
  ],
};
