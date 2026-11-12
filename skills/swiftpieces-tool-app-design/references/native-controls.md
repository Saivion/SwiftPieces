# Native controls and pieces

Which control to reach for, in order of preference: the system control, then a SwiftPieces piece built for the job, then your own view. Write your own only when neither fits, and then match the system's physics and accessibility.

Free pieces install with `npx swiftpieces add <Name>`; Pro screens and blocks with `npx swiftpieces add <id>` and a license key. Check the project's `SwiftPieces/` folder first: what is installed gets composed.

## Choosing

| Job | System first | SwiftPieces when you need more |
| --- | --- | --- |
| On/off setting | `Toggle` in a `Form` or `List` | `LiquidSwitch` for a signature hero toggle (one per screen) |
| Two to five exclusive options | `Picker(...).pickerStyle(.segmented)` | `GlassSegments`, `TrackingTabs`, Pro `lens-tab-bar` |
| Pick one of many | `Picker` with `.menu` or a pushed `.navigationLink` style | `ChoiceGroup`, `FilterRail` |
| Several of many | `List` with `EditMode` selection, or a toggle list | `InterestChips`, `TokenField` |
| A number in a range | `Slider`, `Stepper` | `ScrubStepper`, `RangeSlider`, `LevelPicker`, `TimerDial` |
| Money | `TextField(value:format: .currency(code:))` | `AmountField` |
| A date or range | `DatePicker` (compact or graphical) | `DateStrip`, `DateRangePicker`, `TimeSlotPicker` |
| A form | `Form` with sections | `FormField`, `SecureEntry`, `AddressField`; Pro `code-entry` for one-time codes |
| Item actions | `.contextMenu`, `.swipeActions` | `SwipeActionRow`, `GlassActionMenu` |
| Destructive confirm | `.confirmationDialog` | `HoldToConfirm`, `ConfirmSheet`; Pro `swipe-to-confirm` |
| Short interruption | `.sheet` with `.presentationDetents([.medium, .large])` | `PermissionSheet` for permission priming |
| Transient result | none built in | `Toast`, `NoticeStack`; Pro `toast-stack` for undo |
| Empty state | `ContentUnavailableView` | Pro `ghost-state` |
| Loading | `.redacted(reason: .placeholder)` on the real view | `SkeletonLoader` |
| Success or failure screen | none built in | `OutcomeScreen`, `StatusMorph` |
| Search | `.searchable` plus `.searchSuggestions` | Pro `command-palette` |
| Long list | `List`, `LazyVStack` | `PagedList`, `TaskRow`, `StatusTimeline` |
| Tab root | `TabView` with `Tab` (iOS 18) | `FloatingDock`; Pro `tab-shell` |
| Stepped progress | `ProgressView(value:)` | `StepTrail`, `PageDots` |
| Image viewing | `.fullScreenCover` with a zoomable `ScrollView` | `PhotoViewer`, `DragToDismiss` |
| Photos in | `PhotosPicker` | `AttachmentTray`, `PhotoCropper` |
| Share | `ShareLink` | none: always the system sheet |
| Web page | `SFSafariViewController` or `openURL` | none: always the system |
| Onboarding, paywall, settings | none built in | Pro `onboarding-flow`, `glass-paywall-screen`, `settings-screen` |

## Rules for any control

- At least 44 by 44 pt hit area: `.frame(minWidth: 44, minHeight: 44)` plus `.contentShape(Rectangle())` on small glyph buttons.
- A `Button`, not `.onTapGesture`, for anything tappable: it brings the button trait, press states, keyboard and Switch Control support.
- Stateful custom controls set `.accessibilityValue`, and adjustable ones implement `.accessibilityAdjustableAction`.
- Every gesture has a visible button alternative.
- Pieces take styling as parameters (`tint:`, `style:`). With a theme, pass theme values in; their defaults are generic.
- Read a piece's doc comment for its parameters and copy its `<Name>Example` call site, not its internals. Never edit an installed piece to hard-wire your data; feed it through its public types.

## Liquid Glass

Glass is the floating layer: tab bars, toolbars, floating buttons, pill controls. Never a content background, never a card, never glass on glass. System bars and toolbars adopt it on their own when built with the iOS 26 SDK, so don't paint backgrounds behind them. Custom glass goes through `.spGlass` (Pro) or `glassEffect` inside `if #available(iOS 26.0, *)` with a `.ultraThinMaterial` fallback, and sibling glass views share one `GlassEffectContainer`. The free MCP's `get_liquid_glass_guide` has the full guidance.
