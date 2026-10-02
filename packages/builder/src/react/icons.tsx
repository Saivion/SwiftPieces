// Every icon in the builder comes from Lucide: the chrome, the library tiles, and the stand-ins the
// phone previews draw for SF Symbols (SF Symbols only ship on Apple platforms, so the web preview
// shows the closest Lucide icon while the export writes the real SF Symbol name).
import type { CSSProperties } from "react";
import {
  Activity, AlignLeft, Apple, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, Bookmark, Bot, Calendar, Camera, ChartColumn, ChartPie,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleCheckBig, CircleHelp, CircleUserRound, Clock, Code, Component, Copy,
  CreditCard, Crop, DollarSign, Download, Ellipsis, Eye, Filter, Flame, Globe, GripVertical, Hammer, Hand, Hash, Heart, House, Image, Inbox,
  KeyRound, LayoutGrid, LayoutTemplate, Layers, Leaf, Link, List, ListTodo, Loader, LoaderCircle, Lock, Mail, Maximize2, MessageCircle,
  MessageSquareText, Milestone, Minus, Moon, MousePointerClick, MoveVertical, Music, PanelBottom, Phone, Play, Plus, Redo2, RectangleHorizontal,
  RotateCcw, Rows3, Columns3, Search, Send, Settings, Share, Shield, ShoppingCart, SlidersHorizontal, Smartphone, Sparkles, SquareStack, Star,
  AlarmClock, ArrowUpRight, Banknote, BatteryFull, BedDouble, BellDot, BookOpen, CircleDollarSign, CircleEllipsis, CirclePlus, CircleX, Cloud, Coffee, Crown, Droplet, Dumbbell, EyeOff, FastForward, FileText, Film, Flag, Folder, Footprints, Gamepad2, Gift, GraduationCap, Headphones, Hourglass, Info, Landmark, ListFilter, ClipboardPaste, LockOpen, LogIn, Shuffle, MailOpen, Map, MapPin, MessagesSquare, Mic, Navigation, Package, Paperclip, Pause, Pencil, Pin, Plane, QrCode, RefreshCw, Rewind, RotateCw, ScanFace, ShoppingBag, Snowflake, SquarePen, Tag, ThumbsUp, Timer, TrendingUp, TriangleAlert, Trophy, UserPlus, Users, Utensils, Video, Volume2, WandSparkles, Wifi,
  Sun, TextCursorInput, Palette, Blocks, ListTree, SquareMousePointer, PencilLine, MessageSquareCode, ExternalLink, LockKeyhole, ToggleRight, Trash2, Type, Undo2, User, WalletCards, Workflow, X, Zap, type LucideIcon, ArrowLeftRight } from "lucide-react";

/** SF Symbol name → the Lucide icon the preview draws for it. */
const SF: Record<string, LucideIcon> = {
  "arrow.right": ArrowRight, "chevron.right": ChevronRight, plus: Plus, checkmark: Check, xmark: X, envelope: Mail, lock: Lock,
  person: User, "person.crop.circle.fill": CircleUserRound, magnifyingglass: Search, bell: Bell, gearshape: Settings, house: House,
  heart: Heart, star: Star, sparkles: Sparkles, bolt: Zap, flame: Flame, leaf: Leaf, globe: Globe, camera: Camera, photo: Image,
  cart: ShoppingCart, creditcard: CreditCard, calendar: Calendar, clock: Clock, bookmark: Bookmark, paperplane: Send, tray: Inbox,
  "square.and.arrow.up": Share, trash: Trash2, moon: Moon, "music.note": Music, phone: Phone, "bubble.left": MessageCircle,
  "chart.bar": ChartColumn, shield: Shield, eye: Eye, "hand.wave": Hand, apple: Apple,
  "ellipsis": Ellipsis,
  "ellipsis.circle": CircleEllipsis,
  "square.and.pencil": SquarePen,
  "pencil": Pencil,
  "slider.horizontal.3": SlidersHorizontal,
  "line.3.horizontal.decrease": ListFilter,
  "arrow.left": ArrowLeft,
  "arrow.up": ArrowUp,
  "arrow.down": ArrowDown,
  "arrow.up.right": ArrowUpRight,
  "arrow.clockwise": RotateCw,
  "chevron.down": ChevronDown,
  "chevron.left": ChevronLeft,
  "play.fill": Play,
  "pause.fill": Pause,
  "forward.fill": FastForward,
  "backward.fill": Rewind,
  "speaker.wave.2": Volume2,
  "mic": Mic,
  "video": Video,
  "map": Map,
  "crop": Crop,
  "location": Navigation,
  "mappin": MapPin,
  "airplane": Plane,
  "bag": ShoppingBag,
  "gift": Gift,
  "tag": Tag,
  "crown": Crown,
  "trophy": Trophy,
  "figure.walk": Footprints,
  "bed.double": BedDouble,
  "cup.and.saucer": Coffee,
  "fork.knife": Utensils,
  "book": BookOpen,
  "graduationcap": GraduationCap,
  "doc.text": FileText,
  "folder": Folder,
  "paperclip": Paperclip,
  "link": Link,
  "qrcode": QrCode,
  "faceid": ScanFace,
  "hand.thumbsup": ThumbsUp,
  "message": MessagesSquare,
  "sun.max": Sun,
  "cloud": Cloud,
  "drop": Droplet,
  "snowflake": Snowflake,
  "heart.fill": Heart,
  "star.fill": Star,
  "bell.badge": BellDot,
  "person.2": Users,
  "person.badge.plus": UserPlus,
  "lock.open": LockOpen,
  "key": KeyRound,
  "checkmark.circle.fill": CircleCheck,
  "xmark.circle.fill": CircleX,
  "exclamationmark.triangle": TriangleAlert,
  "info.circle": Info,
  "questionmark.circle": CircleHelp,
  "plus.circle.fill": CirclePlus,
  "minus": Minus,
  "square.grid.2x2": LayoutGrid,
  "list.bullet": List,
  "rectangle.stack": Layers,
  "wand.and.stars": WandSparkles,
  "paintpalette": Palette,
  "textformat": Type,
  "dollarsign.circle": CircleDollarSign,
  "chart.pie": ChartPie,
  "chart.line.uptrend.xyaxis": TrendingUp,
  "banknote": Banknote,
  "building.columns": Landmark,
  "shippingbox": Package,
  "headphones": Headphones,
  "film": Film,
  "gamecontroller": Gamepad2,
  "dumbbell": Dumbbell,
  "timer": Timer,
  "alarm": AlarmClock,
  "envelope.open": MailOpen,
  "arrow.triangle.2.circlepath": RefreshCw,
  "arrow.left.arrow.right": ArrowLeftRight,
  "square.and.arrow.down": Download,
  "icloud": Cloud,
  "hourglass": Hourglass,
  "flag": Flag,
  "pin": Pin,
  "eye.slash": EyeOff,
  "battery.100": BatteryFull,
  "wifi": Wifi,
};

/** The preview's drawing of an SF Symbol. Nothing for "none" or an unknown name. */
/** Symbols whose SF form is solid: drawn filled, the way their `.fill` name reads. */
const SOLID = new Set(["heart.fill", "star.fill", "play.fill", "pause.fill", "forward.fill", "backward.fill", "person.crop.circle.fill"]);

export function Glyph({ name, size = 20, style, strokeWidth = 1.9, className }: { name: string; size?: number; style?: CSSProperties; strokeWidth?: number; className?: string }) {
  const Icon = SF[name];
  if (!Icon || name === "none") return null;
  // Solid symbols are drawn filled; the rest take Style's Symbols (a fill behind the outline for
  // filled and two-tone symbols, as `.symbolVariant(.fill)` and hierarchical rendering do in iOS).
  const solid = SOLID.has(name) && name !== "person.crop.circle.fill";
  // Style's Icon size scales every symbol (--spb-icon-scale), as `.imageScale` does in the app.
  const scaled = `calc(${size}px * var(--spb-icon-scale, 1))`;
  return <Icon aria-hidden className={className} size={size} strokeWidth={strokeWidth} fill={solid ? "currentColor" : "var(--spb-symbol-fill, none)"} fillOpacity={solid ? 1 : ("var(--spb-symbol-fill-opacity, 1)" as unknown as number)} style={{ flexShrink: 0, display: "block", width: scaled, height: scaled, ...style }} />;
}

/**
 * The Pro mark, as pro.swiftpieces.com's navbar badge draws it (components/layout/crown.tsx there):
 * the filled crown in the badge's blue-to-orange ink (--pb-ink-a/b, set by `.spp-pro-mark` in
 * builder.css), tilting on hover like every chrome icon.
 */
export function ProCrown({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} className="ai ai-tilt" fill="url(#spp-pro-ink)" style={{ display: "block", overflow: "visible" }}>
      {/* Every copy declares the same gradient, so a repeated id is harmless. */}
      <defs>
        <linearGradient id="spp-pro-ink" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--pb-ink-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--pb-ink-b)" }} />
        </linearGradient>
      </defs>
      <path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3z" />
      <rect x="5" y="19" width="14" height="2" rx="1" />
    </svg>
  );
}

/** The builder chrome's icons, by the names the panels use. */
export const ui = {
  up: ArrowUp, down: ArrowDown, copy: Copy, trash: Trash2, undo: Undo2, redo: Redo2, close: X, lock: Lock, question: CircleHelp,
  sun: Sun, moon: Moon, download: Download, sparkle: Sparkles, plus: Plus, layers: Layers, code: Code, phone: Smartphone,
  sliders: SlidersHorizontal, more: Ellipsis, play: Play, hammer: Hammer, link: Link, left: ChevronLeft, right: ChevronRight,
  minus: Minus, grip: GripVertical, expand: Maximize2, restart: RotateCcw, back: ArrowLeft, templates: LayoutTemplate,
  grid: LayoutGrid, chevronDown: ChevronDown, check: Check, palette: Palette, edit: PencilLine, prompt: MessageSquareCode,
  external: ExternalLink, lockKey: LockKeyhole, blocks: Blocks, tree: ListTree, inspect: SquareMousePointer,
  search: Search, flow: Workflow, hand: Hand, bookmark: Bookmark, star: Star, dock: PanelBottom, lockOpen: LockOpen, paste: ClipboardPaste, shuffle: Shuffle, signIn: LogIn, crown: Crown,
} satisfies Record<string, LucideIcon>;

/**
 * How each chrome icon moves when its button or link is pointed at, focused or picked: the host
 * site's animated-icon layer (the `.ai-*` classes in each app's globals.css). CSS only, played once
 * per hover, and off under Reduce Motion. Vars tune a move: which way it nudges, how far it turns.
 */
const MOTION: Record<keyof typeof ui, [string, Record<string, string>?]> = {
  up: ["lift"], down: ["drop"], copy: ["pop"], trash: ["tilt"], undo: ["spin", { "--ai-turn": "-360deg" }], redo: ["spin", { "--ai-turn": "360deg" }],
  close: ["close"], lock: ["drop"], question: ["tilt"], sun: ["spin"], moon: ["tilt"], download: ["drop"], sparkle: ["twinkle"], plus: ["spin"],
  layers: ["lift"], code: ["nudge"], phone: ["tilt"], sliders: ["nudge"], more: ["pop"], play: ["nudge"], hammer: ["tilt"], link: ["tilt"],
  left: ["nudge", { "--ai-x": "-2.5px" }], right: ["nudge"], minus: ["pop"], grip: ["bob"], expand: ["bob"], restart: ["spin", { "--ai-turn": "-360deg" }],
  back: ["nudge", { "--ai-x": "-2.5px" }], templates: ["lift"], grid: ["pop"], chevronDown: ["drop"], check: ["pop"], palette: ["tilt"], edit: ["tilt"],
  prompt: ["lift"], external: ["out"], lockKey: ["key"], blocks: ["lift"], tree: ["nudge"], inspect: ["pop"], search: ["search"], flow: ["nudge"],
  hand: ["tilt"], bookmark: ["lift"], star: ["bob"], dock: ["lift"], lockOpen: ["tilt"], paste: ["drop"], shuffle: ["nudge"], signIn: ["nudge"], crown: ["tilt"],
};

export function UI({ name, size = 16, label, strokeWidth = 1.75 }: { name: keyof typeof ui; size?: number; label?: string; strokeWidth?: number }) {
  const Icon = ui[name];
  const [motion, vars] = MOTION[name];
  return <Icon aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} size={size} strokeWidth={strokeWidth} className={`ai ai-${motion}`} style={{ flexShrink: 0, display: "block", overflow: "visible", ...vars }} />;
}

/** One icon per library entry: native components by id, Swift Pieces pieces by what they do. */
const KIND: Record<string, LucideIcon> = {
  text: Type, symbol: Star, card: SquareStack, row: List, button: RectangleHorizontal, "apple-sign-in": Apple, input: TextCursorInput,
  toggle: ToggleRight, segmented: SlidersHorizontal, vstack: Rows3, hstack: Columns3, spacer: MoveVertical, divider: Minus,
  "elastic-button": MousePointerClick, "commit-button": Loader, "hold-to-confirm": Hand, "form-field": TextCursorInput, "secure-entry": KeyRound,
  "amount-field": DollarSign, "filter-rail": Filter, "scrub-stepper": Hash, "task-row": ListTodo, "status-timeline": Milestone,
  "live-stat": Activity, odometer: Hash, "ring-breakdown": ChartPie, "rating-scrub": Star, "reaction-toggle": Heart,
  "outcome-screen": CircleCheck, "skeleton-loader": LoaderCircle, "status-morph": CircleCheckBig, "prompt-chips": MessageSquareText,
  "thinking-state": Bot, "text-reveal": Type, "expandable-text": AlignLeft, "floating-dock": PanelBottom, "motion-card": WalletCards,
  screen: Smartphone,
};

/** The tile icon for a component in the library and in Layers. It swells when its row is pointed at (globals.css .ai-bob). */
export function KindIcon({ id, size = 15, symbol }: { id: string; size?: number; symbol?: string }) {
  if (!KIND[id] && symbol && SF[symbol]) return <Glyph name={symbol} size={size} strokeWidth={1.75} className="ai ai-bob" />;
  const Icon = KIND[id] ?? Component;
  return <Icon aria-hidden size={size} strokeWidth={1.75} className="ai ai-bob" style={{ flexShrink: 0, display: "block" }} />;
}
