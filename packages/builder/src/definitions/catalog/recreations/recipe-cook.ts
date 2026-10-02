// The recipe-cook recreation: what it is (the catalog entry) and what makes each screen work (moves,
// one list per step). Its screens are built in recipe-cook.build.ts, loaded on first open.
import type { Recreation } from "./types.js";

export const recreation: Recreation = {
  entry: {
    kind: "flows", slug: "recipe-cook", title: "Recipe and Cooking Mode", category: "Food & Drink",
    summary: "Your recipes, one recipe with its facts, cooking mode a step at a time, scaling, a week's meal plan and the shopping list, in the Swift Pieces look.",
    description: "A recipe manager in six screens across three tabs on a floating dock, in the Swift Pieces look, light or dark: a recipe library whose All, Quick and Soups tabs swap a grid of recipes to cook again and rows with a picture, time and two lines on each dish, every picture typographic cover art; a recipe under its large title with its cover as the hero, a line on the dish, facts as quiet cards and one squashy Start cooking; a centred cooking mode with an oven timer you turn and one step in focus; a sheet that scales servings on an expanding track and swaps metric for cups in tabs; tonight's recipe as a row with its cover, a week of meals you swipe to pin or remove, with an empty weekend that offers a recipe; and a shopping list with a rolling count over aisles in tracking tabs. Shape lock: actions are pills, cards 24, tiles 16. Built from Screen Header, Tracking Tabs, Cover Grid, Media Row, Stat Grid, Elastic Button, Commit Button, Timer Dial, Focus Steps, Expanding Track, Day Picker, Swipe Action Row, Odometer and Task Row.",
    try: ["Swipe from All to Quick and open a recipe", "Tap Start cooking, turn the oven timer and step through", "Open the sliders button, drag the servings track and swipe to US cups", "Swipe a planned meal, or pick a recipe for the weekend", "Swipe between aisles and tick off the shopping list"],
    interactions: ["tabs", "push", "sheet", "tap", "press", "drag", "swipe", "toggle", "select", "loading", "spring", "haptic"],
    components: ["screen-header", "tracking-tabs", "cover-grid", "media-row", "stat-grid", "elastic-button", "commit-button", "timer-dial", "focus-steps", "expanding-track", "day-picker", "swipe-action-row", "odometer", "task-row"],
    keywords: ["swiftui recipe app", "swiftui cooking mode", "swiftui shopping list", "swiftui meal planner"],
    steps: [
      { title: "Recipes", transition: "start" },
      { title: "Recipe", transition: "push" },
      { title: "Cooking mode", transition: "sheet" },
      { title: "Scale and convert", transition: "sheet" },
      { title: "Meal plan", transition: "tab" },
      { title: "Shopping list", transition: "tab" },
    ],
  },
  moves: [
    ["A two-weight header, then tabs that really swap the list: recipes to cook again as a grid of cover art, then every recipe as a row with its cover, time and course and two lines on the dish."],
    ["A pushed recipe keeps the system large title and back, with scaling in the bar; the dish's cover as a big hero, a line on what it is, three quiet fact cards, then one squashy Start cooking.", "Ingredients sit in one card, names left and amounts in bold on the right; the missing ones go to the list with a loading, then success, button."],
    ["A centred oven timer you turn by its knob sits above the steps; only one step is in full ink, its number lit red, and a swipe moves the focus."],
    ["Servings are one expanding track that swells under your finger; metric and cups are tabs whose pages hold each set of amounts."],
    ["Tonight's recipe leads as a row with its cover you press to open; each planned meal swipes to pin or remove.", "An empty weekend is a composed state with one way forward: pick a recipe."],
    ["A rolling count of what's left tops the list; aisles are tracking tabs you swipe between, and items complete with a drawn check."],
  ],
};
