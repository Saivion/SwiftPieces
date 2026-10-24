// Patterns (called blocks in code, as in Pro, where they are `type: "block"`): whole sections of an iOS screen,
// laid out, wired and given their states. A sign-in pattern is the fields, the button and Sign in with Apple
// already working; you drop it into a screen and connect it to your app.
//
// Every pattern is a SwiftPieces Pro pattern: its source lives in SwiftPieces Pro, themed by Pro's design system,
// and installs only with a Pro license, like Pro's screens and templates. Free lists them at /patterns and
// /docs/patterns, in Pro's categories (Pro registry/types.ts blockGroups), with a still, a recorded loop and their
// facts. Free never reads the Pro registry (Rev 3 §3.2), so `blockCategories` and `proBlocks` below are the one
// hand-kept copy. Refresh them from SwiftPiecesPro/registry/__registry__/public.json (the `block` items, their
// `group` and `highlights`) when a Pro pattern ships or changes, and re-record its still and loop
// (public/pro-blocks/<id>.webp, .webm and .mp4) with Pro's scripts/block-loops.ts. The build still supports free
// blocks in registry/blocks/<category>/<Name>Block.swift, should one ever ship.
// Pure data: safe to import from client components.
import { site } from "./site";

/** Pattern categories, Pro's, in Pro's order. One place for the id, docs slug, title, Xcode folder and one line. */
export const blockCategories = {
  "ai-chat": { slug: "ai-chat", title: "AI Chat", folder: "AIChat", description: "Conversations with an assistant, from the first prompt to the history." },
  "prompt-input": { slug: "prompt-input", title: "Prompt Input", folder: "PromptInput", description: "Composers that attach, dictate, mention and switch models." },
  "agents": { slug: "agents", title: "Agents", folder: "Agents", description: "Plans, tool calls, approvals and live runs for agents." },
  "nav-bars": { slug: "nav-bars", title: "Navigation Bars", folder: "NavigationBars", description: "Headers and top bars that open a screen." },
  "tab-bars": { slug: "tab-bars", title: "Tab Bars", folder: "TabBars", description: "Bottom bars, floating bars with search, and tab strips." },
  "lists": { slug: "lists", title: "Lists and Feeds", folder: "Lists", description: "Inboxes, search, timelines and file lists." },
  "dashboards": { slug: "dashboards", title: "Dashboards", folder: "Dashboards", description: "Metrics and charts at the top of a screen." },
  "settings": { slug: "settings", title: "Settings", folder: "Settings", description: "The groups every Settings screen needs." },
  "forms": { slug: "forms", title: "Forms", folder: "Forms", description: "Profiles, addresses, feedback and step-by-step forms." },
  "sheets": { slug: "sheets", title: "Sheets and Alerts", folder: "Sheets", description: "Sheets, permission asks and release notes." },
  "auth": { slug: "auth", title: "Auth and Onboarding", folder: "Auth", description: "Sign in, recovery and first-run setup." },
  "commerce": { slug: "commerce", title: "Commerce", folder: "Commerce", description: "Carts and checkout." },
} as const;

export type BlockCategory = keyof typeof blockCategories;
export const blockCategoryIds = Object.keys(blockCategories) as [BlockCategory, ...BlockCategory[]];
export const blockCategoryTitle = (id: string): string => (blockCategories as Record<string, { title: string }>)[id]?.title ?? id;

/** A Pro pattern as Free lists it. Its Swift source is never in this repo. */
export type ProBlock = {
  /** Pro registry id: its page is pro.swiftpieces.com/library/patterns/<id>, and its slug on Free. */
  id: string;
  /** The Swift type, which is also the name the CLI installs. */
  name: string;
  title: string;
  category: BlockCategory;
  /** One line, as Pro's library card says it. */
  summary: string;
  /** What the block does, for its page on Free: two or three sentences. */
  description: string;
  /**
   * What is inside it, in reading order, as Pro's library lists it. Pro blocks are self-contained and themed by
   * Pro's design system, like Pro's screens, so these are the block's own parts, not free pieces.
   */
  parts: string[];
  /** Day it shipped ("YYYY-MM-DD"), for the New badge, the same rule as pieces. */
  added: string;
};

export const proBlocks: ProBlock[] = [
  {
    id: "plan-usage",
    name: "PlanUsageBlock",
    title: "Plan and Usage",
    category: "settings",
    summary: "The subscription section of Settings: the plan and its renewal, usage meters that warn near a limit, and the way up.",
    description: "Where a subscriber checks their plan. A summary card names the plan with a tinted status chip, its price and when it renews, ends or leaves its trial; usage meters fill to what has been used and turn to warning and danger near a limit. Upgrade works, confirms and folds away on the top plan, and Manage subscription and Restore purchases use StoreKit by default.",
    parts: ["Plan with its status and renewal", "Usage meters that warn near a limit", "Upgrade with its states", "Manage subscription and restore"],
    added: "2026-10-19",
  },
  {
    id: "invite-friends",
    name: "InviteFriendsBlock",
    title: "Invite Friends",
    category: "settings",
    summary: "A referral section: what both people get, a track that fills as friends join, the invite code to copy or share, and who you invited.",
    description: "The referral section of an account or rewards screen. One card states the reward, fills a seat on a quiet track for each friend who joins, copies the invite code with one tap and opens the system share sheet. Invited friends list below with a status chip, and pending invites can be reminded.",
    parts: ["Reward and a track that fills per friend", "Invite code you copy", "Share invite", "Invited friends with their status"],
    added: "2026-10-19",
  },
  {
    id: "sign-in",
    name: "SignInBlock",
    title: "Sign In",
    category: "auth",
    summary: "The sign-in section of a welcome screen: email and password, Sign in with Apple, a passkey and Create account in one block.",
    description: "Email and password on one card, checked on submit and then live, with Sign in running your closure through working, done and failed. Forgot password confirms inline, Sign in with Apple is the system button in the colour of the appearance, and a link at the foot switches to Create account with password rules that tick off.",
    parts: ["Email and password with autofill", "Sign in with its working, done and failed states", "Sign in with Apple and a passkey", "Forgot password and create account"],
    added: "2026-10-19",
  },
  {
    id: "stats-overview",
    name: "StatsOverviewBlock",
    title: "Stats Overview",
    category: "dashboards",
    summary: "The top of a dashboard: a headline metric and its change, a chart you scrub across 1W to 1Y, and metric tiles.",
    description: "The section at the top of an analytics or dashboard screen. One card holds the headline metric with its change against the previous period and a Swift Charts line you drag across to read any day, with the previous period dashed beneath and a 1W to 1Y control that morphs the line. Metric tiles sit below, and loading, empty and failed states are built in.",
    parts: ["Headline metric and its change", "Chart you scrub", "Range control from 1W to 1Y", "Metric tiles"],
    added: "2026-10-19",
  },
  {
    id: "checkout",
    name: "CheckoutBlock",
    title: "Checkout",
    category: "commerce",
    summary: "A one-column checkout: bag with steppers, address and delivery speed, promo code, summary, then Pay or Apple Pay to the placed order.",
    description: "The checkout section of a cart or checkout screen. Each bag line has a quantity stepper, and the line price, summary and Pay label roll as quantities change; delivery shows the address with Change and each speed with its day and price, and a promo code applies or explains why not. Pay shows its working, done and failed states in place, Apple Pay uses the system button, and the block settles into the placed order with its number and arrival day.",
    parts: ["Bag with quantity steppers", "Address and delivery speed", "Promo code and a total that follows", "Pay and Apple Pay to the placed order"],
    added: "2026-10-19",
  },
  {
    id: "account-settings",
    name: "AccountSettingsBlock",
    title: "Account Settings",
    category: "settings",
    summary: "The account section at the top of Settings: profile and photo, appearance, notifications, your data, sign out and deletion.",
    description: "The part of Settings every app with accounts needs. A profile card changes the photo and the name in place, appearance shows System, Light and Dark as small screens in your theme's colours, and notification toggles know when iOS has notifications off. Export my data, Sign out and Delete account each confirm and show their own working, done and failed states.",
    parts: ["Profile with photo and name", "Appearance in your theme's colours", "Notification toggles", "Your data, sign out and delete account"],
    added: "2026-10-19",
  },
  {
    id: "chat-thread",
    name: "ChatThreadBlock",
    title: "Chat Thread",
    category: "ai-chat",
    summary: "The message list of an assistant chat: replies in light markdown that stream in with Stop, then Copy, Regenerate, rate and Share.",
    description: "The thread of an assistant conversation. The person's turns sit on the fill and replies are plain text with paragraphs, bold, lists, inline code and code blocks with Copy, streamed from an AsyncThrowingStream your app provides, with Stop. Finished replies get Copy, Regenerate, thumbs up and down and Share; a failed reply shows its error with Retry, and the thread exposes an anchor so your scroll view can follow the stream or offer Jump to latest.",
    parts: ["Replies stream in from your AsyncThrowingStream, with Thinking and Stop", "Light markdown: paragraphs, bold, bullet lists, inline code and code blocks with Copy", "Copy that answers Copied, Regenerate, thumbs up and down, and Share", "A failed reply shows its error in place with Retry", "Day separators, ghost rows while loading, and follow-the-stream with Jump to latest"],
    added: "2026-10-23",
  },
  {
    id: "chat-welcome",
    name: "ChatWelcomeBlock",
    title: "Chat Welcome",
    category: "ai-chat",
    summary: "The start of a new assistant chat: a greeting, suggestion cards by intent that page sideways, Shuffle, and recent chats to continue.",
    description: "The empty start of a new chat. A greeting with the person's name sits over a prompt line, intents (Write, Learn, Plan, Code) pick a two-row grid of suggestion cards that pages sideways, and a tapped card hands its prompt to your app and marks itself. Shuffle fetches fresh suggestions with its own working and failed states, and Continue where you left off lists the three most recent chats with See all.",
    parts: ["A greeting by time of day with the person's name, in the brand's display face", "Write, Learn, Plan and Code over a two-row grid of cards that pages sideways", "Tapping a card hands its prompt to your app and marks it", "Shuffle fetches fresh suggestions with working and failed states", "The three most recent chats with See all, ghosts while loading"],
    added: "2026-10-23",
  },
  {
    id: "chat-history",
    name: "ChatHistoryBlock",
    title: "Chat History",
    category: "ai-chat",
    summary: "Past assistant chats: live search, Pinned and date groups, swipe and context actions, inline rename and delete that confirms.",
    description: "The list of past conversations. A search field filters by title and last line as you type, and chats sit under Pinned, Today, Yesterday, Previous 7 days and Earlier. Swipe a row for Pin and Delete or hold it for Rename, Pin, Share and Delete; rename edits the title in place, and delete confirms, fades the row while your closure runs and restores it with the error if it fails.",
    parts: ["Live search by title and last line, with a no-results state", "Pinned, Today, Yesterday, Previous 7 days and Earlier", "Swipe for Pin and Delete, or hold for Rename, Pin, Share and Delete", "Rename in place; Delete confirms, fades the row, and restores it on failure", "No chats yet with New chat, and ghost rows while loading"],
    added: "2026-10-23",
  },
  {
    id: "chat-attachments",
    name: "AttachmentChatBlock",
    title: "Attachment Chat",
    category: "ai-chat",
    summary: "An assistant chat with photos and files: thumbnails and file chips with upload rings and Retry, returned files to open or share.",
    description: "A conversation where the person shares photos and files. Their photos lay out one large, two side by side or in a grid with +N, files show as chips with a type icon, name and size, and each attachment shows its upload progress or Retry. The assistant's replies can return files as cards that open in Quick Look or share, and tapping a photo opens a full-screen viewer with zoom.",
    parts: ["Photos one large, two side by side, or a grid with +N", "File chips with an icon for the type, the name and the size", "A progress ring per attachment while it uploads, and Retry when it fails", "Returned files as cards with Open in Quick Look and Share", "A full-screen photo viewer with pinch and double-tap zoom"],
    added: "2026-10-23",
  },
  {
    id: "composer-attachments",
    name: "AttachmentComposer",
    title: "Attachment Composer",
    category: "prompt-input",
    summary: "A message composer that attaches photos and files, uploads each with its own progress ring, and turns Send into Stop.",
    description: "A composer pinned above the keyboard with a plus menu for Photos, Camera and Files. Each pick lands in a tray as a thumbnail or file chip and uploads through your closure with a ring that fills, or a failure you can retry; Send waits for text or an attachment and every upload, and turns into Stop while the reply runs.",
    parts: ["Photos, Camera and Files from one plus menu", "A tray of removable thumbnails and file chips", "Each upload shows a filling ring, done, or failed with Retry", "A field that grows from one to six lines, with a counter near the limit", "Send waits for uploads, then turns into Stop while the reply runs"],
    added: "2026-10-23",
  },
  {
    id: "composer-dictation",
    name: "DictationComposer",
    title: "Dictation Composer",
    category: "prompt-input",
    summary: "A message composer with voice input: a live level meter, elapsed time, Cancel and Done, and the transcript filling the field.",
    description: "A composer pinned above the keyboard whose mic turns the bar into a recording state, with a level meter that moves with the voice, the elapsed time, Cancel and Done, while the transcript fills the field. It runs on the Speech framework and AVAudioEngine, asks for access and offers Settings when it is off, and takes your own transcription for previews or another engine.",
    parts: ["The mic turns the bar into Cancel, a live level meter, the time and Done", "The transcript fills the field as you speak, after anything typed", "Speech framework and AVAudioEngine, with access asked and Open Settings when off", "Your own transcription through one value, or a scripted one for previews", "Send turns into Stop while the reply runs"],
    added: "2026-10-23",
  },
  {
    id: "composer-mentions",
    name: "CommandComposer",
    title: "Command Composer",
    category: "prompt-input",
    summary: "A message composer with slash commands and at mentions: a filtered suggestion panel, chips for picks, and structured tokens on send.",
    description: "A composer pinned above the keyboard that opens a suggestion panel when a word starts with / or @. Commands filter as you type, mentions search through your closure with Searching, no matches and Retry, and a pick becomes a chip above the text that onSend receives as a structured token.",
    parts: ["/ opens commands with a symbol, name and line, filtered as you type", "@ searches people and files through your closure", "Searching, no matches and a failure with Retry in the panel", "Picks become chips that remove with x or Delete", "onSend gets the text and the tokens, and Send turns into Stop"],
    added: "2026-10-23",
  },
  {
    id: "composer-modes",
    name: "ModelComposer",
    title: "Model Composer",
    category: "prompt-input",
    summary: "A message composer with a model menu, Search, Think and Image chips, and a usage line that warns near the limit.",
    description: "A composer pinned above the keyboard with a model pill whose menu describes each model and marks locked ones as Pro, mode chips that toggle, and a line of messages left that turns to the warning colour near the limit. At the limit the composer turns off and offers Upgrade; the app owns the model and modes through bindings.",
    parts: ["A model menu with a line about each model and Pro on locked ones", "Search, Think and Image chips that show their name when on", "\"12 messages left today\", warning near the limit", "Turns off at the limit with Upgrade", "Bindings for model and modes, and Send that turns into Stop"],
    added: "2026-10-23",
  },
  {
    id: "agent-plan",
    name: "AgentPlanBlock",
    title: "Agent Plan",
    category: "agents",
    summary: "An agent's task plan as a checklist: review and edit the steps, approve, then watch them tick through with live notes.",
    description: "Where a person sees what an agent intends to do and follows it as it runs. In review the steps are numbered and can be renamed, removed, reordered or added to before Approve plan; once running, each step reads pending, running with its notes, done, failed with Retry step, or skipped, and the card folds to a one-line summary.",
    parts: ["Review mode with numbered steps, then Approve plan with working, done and failed in place", "Edit steps inline: rename, remove, drag to reorder or add, with VoiceOver move actions", "Pending, running, done, failed and skipped steps, the running one showing its notes", "Retry step on a failed step, with its reason", "Folds to one line naming the step in progress"],
    added: "2026-10-23",
  },
  {
    id: "tool-calls",
    name: "ToolCallsBlock",
    title: "Tool Calls",
    category: "agents",
    summary: "The tools an agent used in one reply, folded to \"Used 4 tools · 3.2s\" and opening to each call's arguments and result.",
    description: "A small, inline record for the top of an assistant message. Folded it is one quiet row; opened, each call shows its symbol, name, argument summary and duration or status, and opens to its arguments and result as key and value pairs or monospaced JSON with Copy. It opens itself while calls run and folds once they finish.",
    parts: ["One summary row: tools used, total time and any failures", "A row per call with its symbol, arguments in one line and a spinner, duration or Failed", "Arguments and results as aligned pairs or monospaced JSON with Copy", "Failed calls show the error and Retry", "Opens while calls run and folds once the last one finishes"],
    added: "2026-10-23",
  },
  {
    id: "agent-approval",
    name: "AgentApprovalBlock",
    title: "Agent Approval",
    category: "agents",
    summary: "An agent asks before it acts: the action, its risk and a preview of the change, then Allow once, Always allow or Deny.",
    description: "The permission prompt for an agent about to act. A card names the agent and tool with a tinted risk chip, states the action and why, counts down to an automatic deny when it has a deadline, and previews the change as an email, a list of affected items or a value before and after. Each answer runs your closure in place, and the block folds to a one-line outcome.",
    parts: ["The action as a verb and target, the agent and tool, and a Low, Medium or High risk chip", "Previews an email, the affected items with Show all, or a value before and after", "Allow once, Always allow for the tool and Deny, each with working and failed in place", "An optional countdown that denies on its own", "Folds to \"Allowed once · 2:41 PM\" once decided"],
    added: "2026-10-23",
  },
  {
    id: "agent-run",
    name: "AgentRunBlock",
    title: "Agent Run",
    category: "agents",
    summary: "A long-running agent task live: state, elapsed time, current activity, steps, tokens and cost, Pause and Stop, then its result.",
    description: "The status section for an agent working in the background. It shows the state, a ticking clock, what the agent is doing now, a segmented step bar and the tokens and cost so far, with Pause, Resume and a confirmed Stop, and Notify me when done through the system permission. It settles into a summary with the outputs to open, or the reason and Retry when it fails.",
    parts: ["Queued, Running, Paused, Needs input, Finished and Failed in one tinted chip", "Elapsed time ticking in the brand's figures, with the activity changing in place", "A segmented step bar and tokens and cost so far", "Pause, Resume and Stop with a confirmation, and Notify me when done", "Settles into a summary with outputs and Open, or the reason with Retry"],
    added: "2026-10-23",
  },
  {
    id: "greeting-header",
    name: "GreetingHeader",
    title: "Greeting Header",
    category: "nav-bars",
    summary: "The top of a home tab: the date, a bell with its unread count, the avatar, a greeting by time of day and search, folding into a compact bar.",
    description: "A home tab's header in place of a plain large title. Today's date, the notifications bell with an unread badge and the avatar sit on one row over a greeting for the time of day and a search field. As content scrolls the greeting and search fold away into a compact bar, driven by the scroll offset on iOS 18 or by any value you pass.",
    parts: ["A greeting for the time of day with the person's name, in the brand's display face", "The bell's unread badge rolls to each new count", "The avatar opens the profile, with initials when there is no photo", "Folds into a compact bar as content scrolls, with search as a button", "Pins over your scroll view with one modifier, and shows grey shapes while loading"],
    added: "2026-10-23",
  },
  {
    id: "scope-header",
    name: "ScopeHeader",
    title: "Scope Header",
    category: "nav-bars",
    summary: "A feed header: the title, scopes as text tabs with a sliding underline, filter chips that scroll, and a Filters button with its count.",
    description: "The header of a feed. Scopes such as For you, Following and Saved sit as text tabs with an underline that slides to the one you pick, and filter chips scroll sideways beside a Filters button that counts what is on. It pins over the feed as a section header and shows a hairline once it is stuck.",
    parts: ["Scopes as text tabs with an underline that slides between them", "Filter chips that scroll sideways and toggle with a check", "A Filters button whose count rolls as filters change", "Pins as a section header and shows a hairline when stuck", "Bindings for the scope and the chips, with loading chips"],
    added: "2026-10-23",
  },
  {
    id: "location-header",
    name: "LocationHeader",
    title: "Location Header",
    category: "nav-bars",
    summary: "The header of a delivery or local app: the address and its chooser, search, a Now or Schedule pill, and the bag with its count.",
    description: "Deliver to over the current address opens a chooser of saved addresses with a radio selection, Use current location through CoreLocation and Add address. Picking an address runs your check in the row before it applies. A search field, a Now or Schedule pill and the bag with its count complete the header.",
    parts: ["The current address with a chooser of saved addresses and a radio selection", "Use current location asks for permission, finds you and handles location being off", "Your address check runs in the row, with its error shown in place", "A pill for Now or a scheduled time, with a menu to switch", "A search field and the bag's count, with grey shapes while loading"],
    added: "2026-10-23",
  },
  {
    id: "selection-toolbar",
    name: "SelectionToolbar",
    title: "Selection Toolbar",
    category: "nav-bars",
    summary: "Edit mode for any list: a top bar with the count, Select all and Done, an action bar, selection circles on rows, and Undo.",
    description: "Select mode for a list or grid. A top bar takes the navigation bar's place with the count, Select all and Done, rows gain selection circles, and an action bar of Share, Move, Duplicate and Delete enables by count. Actions run your async closures with working shown in place, Delete confirms with the count, and a line confirms each result with Undo.",
    parts: ["A generic selection model and a row modifier that adds the selection circle", "A top bar with a rolling count, Select all or Deselect all, and Done", "Share, Move, Duplicate and Delete that enable by count, or your own actions", "Actions show working in place; Delete confirms with the count", "A confirmation line with Undo after each action, or the error"],
    added: "2026-10-23",
  },
  {
    id: "action-tab-bar",
    name: "ActionTabBar",
    title: "Action Tab Bar",
    category: "tab-bars",
    summary: "A floating tab bar with a round create button set apart that opens quick actions over a scrim, with badges and tap again to scroll up.",
    description: "Four tabs in one floating capsule, the selected one on a quiet pill, with a round accent create button beside it; each tab is a symbol over its label with an optional badge. The create button opens a menu of quick actions above the bar over a scrim, runs the one you pick and shows working, done and failed itself. Tapping the selected tab again calls your closure to scroll it to the top.",
    parts: ["Four tabs around a central create button, generic over your own tab enum", "A quick-create menu above the bar over a scrim, closing on pick or tap outside", "The create button shows working, done and failed for the action it ran", "Badge counts on tabs and tap again to scroll to top", "Tabs keep their state once visited, as in TabView"],
    added: "2026-10-23",
  },
  {
    id: "accessory-tab-bar",
    name: "AccessoryTabBar",
    title: "Accessory Tab Bar",
    category: "tab-bars",
    summary: "A tab bar with a live accessory above it for what is playing or running, folding inline into the bar as the content scrolls.",
    description: "A compact accessory above the tab bar shows what is live: artwork, title and subtitle, a progress line and play and pause or one control of your own, opening its full view when tapped. Scrolling down folds it inline into the bar beside the selected tab, and scrolling up brings it back. On iOS 26 it is the system bar's tabViewBottomAccessory, with the block's own bar before.",
    parts: ["A live accessory row with artwork, progress and one control", "Folds inline into the bar on scroll down and returns on scroll up", "The system tabViewBottomAccessory on iOS 26, a matching custom bar on iOS 17", "Play and pause, or your own control, with working and failed states", "Tap the accessory to open its full view through your closure"],
    added: "2026-10-23",
  },
  {
    id: "top-tabs",
    name: "TopTabs",
    title: "Top Tabs",
    category: "tab-bars",
    summary: "A scrolling strip of top tabs over swipeable pages, its indicator tracking the swipe and the strip keeping the selected tab in view.",
    description: "A strip of tabs over a pager of your pages. The accent indicator follows the pager continuously, stretching to each tab's width, tapping a tab pages to it, and the strip scrolls to keep the selected tab in the middle. Tabs can show counts, and three or fewer share the width while more scroll.",
    parts: ["An indicator that tracks the swipe and stretches to each tab's width", "Tap a tab to page to it, the strip scrolling to keep it centred", "Counts on tabs, in a quiet capsule", "Few tabs fill the width, many tabs scroll", "Generic over your own tab type, with lazily built pages"],
    added: "2026-10-23",
  },
  {
    id: "search-tab-bar",
    name: "SearchTabBar",
    title: "Search Tab Bar",
    category: "tab-bars",
    summary: "A floating tab bar with search set apart: tap it and the tabs fold away as it opens into a field over your recent searches.",
    description: "The tabs sit in one floating capsule with the selected tab on a quiet pill, and a round search button stands beside it, the way iOS 26 apps place search. Tapping search folds the tabs into one round button showing the current tab and opens the button into a field with the keyboard up. The screen above shows recent searches, then your results as the query changes, and tapping the folded tab goes back.",
    parts: ["Tabs in a floating capsule, the selected one on a sliding pill", "Search set apart, opening into a field as the tabs fold away", "Recent searches with Clear, kept in your own store", "Your results view for the query, in place of the tab", "Badges, tap again to scroll to top, and tabs that keep their state"],
    added: "2026-10-23",
  },
  {
    id: "notification-inbox",
    name: "NotificationInbox",
    title: "Notification Inbox",
    category: "lists",
    summary: "An in-app notifications list: All, Mentions and Unread, day groups, inline Accept and Reply, swipe actions and Mark all as read.",
    description: "The notifications list of a workspace, social or commerce app. Rows group into New, Earlier this week and Older, each with the actor's photo or initials, one sentence with the names in semibold, the time and an unread dot, and invites, mentions and shares carry inline buttons that show working, done and failed in place. Swipe or long-press to mark read, unread or delete, and Mark all as read clears every dot with a rolling count.",
    parts: ["All, Mentions and Unread with the unread count", "New, Earlier this week and Older groups on calm cards", "Accept, Decline, Reply and View with per-row working, done and failed", "Swipe or long-press to mark read, unread or delete", "Mark all as read, empty states per filter and loading shapes"],
    added: "2026-10-23",
  },
  {
    id: "search-panel",
    name: "SearchPanel",
    title: "Search Panel",
    category: "lists",
    summary: "The body of a search screen: recent and suggested searches, live suggestions with the match highlighted, and results by scope.",
    description: "Drop it under a `.searchable` field. Before typing it shows recent searches with remove and Clear all and suggested searches as chips; while typing it asks your closure for debounced suggestions with the typed text highlighted; after a search it shows scope chips with counts and a card of results per scope, with loading, failed and no-results states built in.",
    parts: ["Recent searches with remove and Clear all, kept for you", "Suggested searches as chips before typing", "Debounced live suggestions with the typed text in semibold", "Results by scope with counts and Show all", "Loading shapes, no results with a hint, and Try again on failure"],
    added: "2026-10-23",
  },
  {
    id: "activity-timeline",
    name: "ActivityTimeline",
    title: "Activity Timeline",
    category: "lists",
    summary: "A day-by-day log on a rail: status-tinted nodes, attachment chips, folded runs, a filter by kind and paging to earlier activity.",
    description: "For order history, account activity or a project log. Events group under Today, Yesterday and dated headers, each with a node on a hairline rail that is tinted only for a real outcome, a title and time, a detail line and an optional attachment chip. Runs of one kind fold into one line that opens in place, a menu filters by kind, and Show earlier activity pages back with its working, failed and end states.",
    parts: ["Day groups on a hairline rail with a node per event", "Nodes tinted only for real outcomes, like a failed build", "Attachment chips that open their file or link", "Runs of one kind fold into \"4 more edits\"", "A filter menu by kind and paging to earlier activity"],
    added: "2026-10-23",
  },
  {
    id: "file-list",
    name: "FileList",
    title: "File List",
    category: "lists",
    summary: "A files section: storage by type, sort and list or grid, uploads with progress, rename, share, move and delete, and Add.",
    description: "The files section of a folder, project or storage screen. A storage card splits the used space by type, the toolbar sorts by name, date, size or kind and switches between list and grid, and Add opens the system file importer or photo picker. Uploads show progress and Cancel and land as files, and every file has Rename in place, Share, Move and a confirmed Delete.",
    parts: ["Used of total with a bar and legend split by type", "Sort by name, date, size or kind, in a list or a grid", "Uploads with progress and Cancel that land as files", "Rename in place, Share, Move and Delete with a confirmation", "Add through the file importer or the photo picker"],
    added: "2026-10-23",
  },
  {
    id: "notification-settings",
    name: "NotificationSettings",
    title: "Notification Settings",
    category: "settings",
    summary: "The Notifications page of Settings: the real iOS permission, Push, Email and SMS per category, quiet hours and a digest that autosave.",
    description: "Where people choose what reaches them and how. A status card reads the app's real permission and offers Turn on notifications or Open Settings, each category toggles its Push, Email and SMS chips, and quiet hours and the email digest sit beside them. Every change writes through your binding and saves after a short pause, with Saving, Saved and Not saved with Retry shown beside the group you changed.",
    parts: ["Reads the real notification permission and asks or opens Settings from it", "Push, Email and SMS chips for each kind of notification", "Quiet hours with From and To times, and an Off, Daily or Weekly digest", "Autosaves after a pause, with Saving, Saved and Retry beside each group", "Loading, never asked, declined and quiet delivery states"],
    added: "2026-10-23",
  },
  {
    id: "privacy-settings",
    name: "PrivacySettings",
    title: "Privacy Settings",
    category: "settings",
    summary: "The Privacy page of Settings: each permission's real status with a tap to ask or change it, data toggles, a data export and the policies.",
    description: "Where people see what the app may use and what it does with their data. Each permission you declare shows its real status from iOS, asks there and then when it was never asked, and opens Settings otherwise. Data toggles, Download my data with working, done and failed states, blocked accounts and the policies follow.",
    parts: ["Camera, Photos, Location, Contacts, Microphone and Notifications read live from iOS", "Allowed, Limited, Not allowed and Not asked chips, with Limited for partial access", "Tapping Not asked asks iOS in place; any other status opens Settings", "Data toggles bound to your settings and Download my data with its states", "Blocked accounts, Privacy policy and Terms rows appear when you pass them"],
    added: "2026-10-23",
  },
  {
    id: "help-support",
    name: "HelpSupport",
    title: "Help and Support",
    category: "settings",
    summary: "The Help section of Settings: search that filters answers as you type, questions that open in place, chat, email, call and a problem report.",
    description: "Where people look for an answer before they ask. A search field filters your articles live and the top questions open in place, then Contact us offers chat with its availability, email, a call with your hours and Report a problem. The report sheet sends a category, a description and optional diagnostics, and the version line copies with a tap.",
    parts: ["Live search across questions, answers and keywords, with a count and an empty state", "Questions that open in place with a link to the full article", "Chat with an Online or Away chip, Email and Call with your hours", "A report sheet with a category, description, diagnostics and Send states", "A version line that copies with a tap"],
    added: "2026-10-23",
  },
  {
    id: "storage-settings",
    name: "StorageSettings",
    title: "Storage",
    category: "settings",
    summary: "The Storage page of Settings: what the app takes in a split bar, Clear cache that confirms and counts down, removable downloads and options.",
    description: "Where people see and reclaim the room an app takes. A summary card shows the total, the device's free space and a bar split into downloads, cache, photos and other; Clear cache confirms, works and shrinks its segment as the figures count down. Downloads remove from Edit or a long press, and the options cover cellular, quality and when finished downloads go.",
    parts: ["The total in the brand's face, with the device's free space beside it", "A bar and legend for downloads, cache, photos and other", "Clear cache confirms, then shrinks its segment as the figures count down", "Downloads that remove from Edit, a long press or VoiceOver", "Cellular, quality and auto-remove options bound to your settings"],
    added: "2026-10-23",
  },
  {
    id: "profile-form",
    name: "ProfileForm",
    title: "Profile Form",
    category: "forms",
    summary: "An edit-profile section: photo, name, a username that checks itself as it's typed, bio with a count, and Save.",
    description: "The edit-profile section of an account screen or sheet. The photo changes through the system picker, the username checks availability through your closure and offers suggestions when it's taken, and the bio counts toward its limit. Save wakes only when something changed and everything is valid, shows working, done and failed, and `hasChanges` lets your sheet confirm before discarding edits.",
    parts: ["Photo with the system picker, Change and Remove", "A username that checks itself, with suggestions when it's taken", "Bio with a count that warns near the limit", "Optional pronouns and website, checked as you leave them", "Save only when changed and valid, plus `hasChanges` for a discard prompt"],
    added: "2026-10-23",
  },
  {
    id: "address-form",
    name: "AddressForm",
    title: "Address Form",
    category: "forms",
    summary: "A shipping or billing address form with AutoFill, a searchable country list, per-country labels and street suggestions.",
    description: "The address section of a checkout, account or delivery screen. Every line carries its AutoFill type, the country opens a searchable list and relabels the region and postal code for it, and street suggestions from MapKit fill the city, region and postal code when picked. Fields check on Save and then live, and Save shows working, done and failed.",
    parts: ["AutoFill types on every line", "A searchable list of every country and region", "State and ZIP code, County and Postcode, labelled for the country", "Street suggestions from MapKit that fill the rest of the address", "Checks on Save then live, Set as default, and Save with its states"],
    added: "2026-10-23",
  },
  {
    id: "feedback-form",
    name: "FeedbackForm",
    title: "Feedback Form",
    category: "forms",
    summary: "A send-feedback section: a five-step rating, topic chips, a message, screenshots, device info and a thank-you.",
    description: "The send-feedback section of a Help or Settings screen. A numbered rating, Bug, Idea, Billing and Other chips that change the message's prompt, up to three screenshots from the system picker, and Include device info that lists exactly what it sends. Send checks for a topic and a message, shows its working and failed states, and a thank-you replaces the form once it lands.",
    parts: ["A five-step rating from Not great to Love it", "Topic chips that change the message's prompt", "Up to three screenshots from the system picker, removable", "Include device info that shows exactly what it sends", "An optional reply email when signed out, and a thank-you with Done"],
    added: "2026-10-23",
  },
  {
    id: "step-form",
    name: "StepForm",
    title: "Step Form",
    category: "forms",
    summary: "A multi-step form container: a step indicator, your view per step, Back and Continue, Review with Edit, and Submit.",
    description: "A container for forms that take several steps, such as a booking or a new project. Each step is your own view with a validity flag, so Continue waits until it's complete, and steps slide in from the side they come from. Review sums up the answers each step reports with Edit links that jump back, and Submit shows working, done and failed.",
    parts: ["Segments with \"Step 2 of 4\" and the step's name", "Your own view per step, with Continue waiting until it's valid", "Steps that slide in from their side, or fade with Reduce Motion", "Review built from each step's answers, with Edit links that jump back", "Submit with working, done and failed, then a settled sent state"],
    added: "2026-10-23",
  },
  {
    id: "share-sheet",
    name: "ShareActionsSheet",
    title: "Share Sheet",
    category: "sheets",
    summary: "Your app's own share sheet: the item up top, recent people to send to, Copy link, Save, Collection, More and Report.",
    description: "The content of a share and actions sheet for a post, article or file. A header shows the item, recent people and conversations sit in a strip you select from before sending with an optional message, and action tiles copy the link, save it, add it to a collection or open the system share sheet. Report confirms first, and every action shows its working, done and failed states.",
    parts: ["The item in a header with its thumbnail, title, link and Close", "Select recent people, add a message and Send, with Sent shown in place", "Copy link answers Copied; Save and Collection run your closures", "More opens the system share sheet with the item's preview", "Report in the danger colour, confirmed first, plus a loading layout"],
    added: "2026-10-23",
  },
  {
    id: "permission-primer",
    name: "PermissionPrimer",
    title: "Permission Primer",
    category: "sheets",
    summary: "Explain-then-ask for notifications, location, the camera or photos, then answer what iOS says: granted, or Open Settings.",
    description: "A primer shown before a system permission prompt. It explains why the app needs the permission, lists what it makes possible, draws the alert iOS will show next, then requests the real permission. Granted turns to a check and calls back; denied explains where to change it and offers Open Settings, and turns granted when the person comes back having allowed it.",
    parts: ["One large symbol, the reason and two or three benefits", "A drawing of the alert iOS shows next, so the prompt is no surprise", "Continue requests the real permission for notifications, location, camera or photos", "Granted shows a check and calls onGranted; denied offers Open Settings", "Reads the current status on appear and again on return from Settings"],
    added: "2026-10-23",
  },
  {
    id: "whats-new",
    name: "WhatsNewSheet",
    title: "What's New",
    category: "sheets",
    summary: "A release notes sheet shown once per version: version and date, a title, features with symbols, Try it and Continue.",
    description: "The sheet an app shows once after an update. The version and date sit over a title, three to five features come in one after another, one can link straight to the feature, and Continue closes it. A modifier keeps the last seen version in AppStorage and presents the sheet only when the release is newer.",
    parts: ["Version, date and a title in the display face", "Three to five features, each a symbol, a title and one line", "An optional Try it link that opens the feature", "See all release notes opens your full notes", "whatsNewSheet(_:) shows it once per version from AppStorage"],
    added: "2026-10-23",
  },
  {
    id: "schedule-sheet",
    name: "ScheduleSheet",
    title: "Schedule Sheet",
    category: "sheets",
    summary: "Pick when something happens: quick picks with real times, a calendar and time picker, repeat rules and Schedule.",
    description: "The sheet for send later, a reminder or a booking. Quick picks resolve to real times and hide once they pass, Pick date and time opens a graphical calendar and a time picker in place, and Repeat covers Never, Daily, Weekdays, Weekly and custom days. Schedule names the chosen moment, runs your closure with a Schedule value and shows working, Scheduled and failed.",
    parts: ["Later today, Tonight, Tomorrow morning and Next week with their times", "Picks that have passed are hidden, even while the sheet is open", "A graphical calendar and a time picker that open in place", "Repeat: Never, Daily, Weekdays, Weekly or custom days of the week", "Schedule returns a Schedule value and shows working, Scheduled and failed"],
    added: "2026-10-23",
  },
  {
    id: "magic-link",
    name: "MagicLinkSignIn",
    title: "Email Link Sign In",
    category: "auth",
    summary: "Passwordless sign-in by email: send a link, check your inbox with Open Mail and a Resend countdown, or enter a code instead.",
    description: "An email field that checks itself and Continue with email, which runs your closure through working, done and failed. The card then turns to Check your inbox with the address, Open Mail and Resend on a countdown, plus an optional six-digit code that fills from AutoFill and submits itself. Links that open your app sign the person in through `onLink`.",
    parts: ["An email field that checks on submit, then live, with AutoFill", "Continue with email shows working, a check, or your error's message", "Check your inbox with Open Mail and a Resend countdown", "An optional six-digit code that fills from AutoFill and submits itself", "Sign-in links handled on screen, plus `.onSignInLink` for your root"],
    added: "2026-10-23",
  },
  {
    id: "reset-password",
    name: "ResetPasswordBlock",
    title: "Reset Password",
    category: "auth",
    summary: "Account recovery in one block: request a code by email, verify it, choose a new password with rules that tick off, then sign in.",
    description: "Three steps on one card under a Step 1 of 3 track: the email and Send code, a six-digit code with a Resend countdown and a wrong-code error, and a new password with strong-password AutoFill, show and hide, rules that tick off and a confirm field. Each step runs your closure through working, done and failed, Back returns a step, and a done state ends on Sign in.",
    parts: ["Request, verify and new password on one card with a step track", "A six-digit code that fills from AutoFill, verifies itself and counts down to Resend", "A wrong code shows your error and clears the boxes", "Strong-password AutoFill, show and hide, and rules that tick off", "Each step shows working, a check, or your error's message, with Back between steps"],
    added: "2026-10-23",
  },
  {
    id: "profile-setup",
    name: "ProfileSetup",
    title: "Profile Setup",
    category: "auth",
    summary: "The first-run profile step: a photo or initials colour, a display name, a username checked live, an optional role, and Continue or Skip.",
    description: "The profile step right after sign up, with where the person is in your first run, a large title and minimal fields. The avatar takes a photo from the system picker or shows initials on one of five theme colours, the username is cleaned as it's typed and checked for availability through your closure, and an optional role and birthday follow. Continue runs your closure through working, done and failed, and Skip for now leaves without saving.",
    parts: ["Step 2 of 3, a large title and only the fields a first run needs", "A photo from the system picker, or initials on one of five theme colours", "A username cleaned as it's typed and checked live: Checking, yours, or taken", "An optional role menu and birthday", "Continue shows working, a check, or your error's message, with Skip for now"],
    added: "2026-10-23",
  },
  {
    id: "interests-picker",
    name: "InterestsPicker",
    title: "Interests Picker",
    category: "auth",
    summary: "A first-run step for picking topics: wrapping chips by section, a search that filters, a count that rolls, and Continue at the minimum.",
    description: "Topics as chips with a symbol and a label, grouped under section titles in a flow layout that fits any width and text size. Picked chips take a light accent tint with a check, the count rolls, a search filters as it's typed, and the button counts down Pick 2 more until the minimum turns it into Continue, which runs your closure through working, done and failed. An optional maximum steps the other chips back.",
    parts: ["Chips with a symbol and label in a wrapping flow layout, grouped by section", "Picked chips take an accent tint and a check as the count rolls", "Search filters by topic or section, with a no-match state", "Pick 2 more until the minimum, then Continue with working, done and failed", "An optional maximum, and grey chips while topics load"],
    added: "2026-10-23",
  },
];

/** A free block's slug drops the type's "Block" suffix: SignInBlock is sign-in. */
export function blockSlug(name: string): string {
  return name
    .replace(/Block$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** A pattern's slug on Free: a Pro pattern's is its Pro id, so both sites share one URL tail. */
export const patternSlug = (block: { name: string; id?: string }) => block.id ?? blockSlug(block.name);

/** Canonical docs path for a pattern, free or Pro: /docs/patterns/<category>/<slug>. */
export function blockPath(block: { category: string; name: string; id?: string }): string {
  return `/docs/patterns/${(blockCategories as Record<string, { slug: string }>)[block.category]?.slug ?? block.category}/${patternSlug(block)}`;
}

/** Where a Pro pattern opens in Pro's library. */
export const proBlockUrl = (id: string) => `${site.proUrl}/library/patterns/${id}`;

/** Old /docs/blocks/<category>/<slug> pages of the first six, which moved category when they became patterns. */
export const legacyBlockDocs: Array<[string, string]> = [
  ["auth/sign-in", "auth/sign-in"],
  ["settings/account-settings", "settings/account-settings"],
  ["settings/plan-usage", "settings/plan-usage"],
  ["social/invite-friends", "settings/invite-friends"],
  ["analytics/stats-overview", "dashboards/stats-overview"],
  ["commerce/checkout", "commerce/checkout"],
];
