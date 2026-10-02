// The build for the podcast-player remix: its screens, from registry components. See podcast-player.ts.
import type { CatalogBuilder } from "../../../core/catalog.js";
import type { ScreenNode } from "../../../core/schema.js";
import { app, body, caption, col, flex, footnote, nd, row } from "../kit.js";

const SHOWS = "Quiet Engines, Map Room, Salt & Signal, Ground Floor, Warm Static, Long Division, Weather Desk, Field Recording, Slow Money, Tin Roof, Open Question, Half Light";

/** The shape lock: actions are pills, cards 24, covers and thumbnails 16. */
const CARD = { style: "card", padding: 16, radius: 24 } as const;
const COVER = 16;

/** A section's heading: title on the leading edge, a quiet count on the trailing one. */
const head = (title: string, meta: string): ScreenNode =>
  row({ spacing: 8, alignment: "bottom" }, [nd("text", { text: title, style: "title3", weight: "semibold" }), flex(), footnote(meta)]);

/** Puts something on the screen's centre line. */
const centered = (child: ScreenNode): ScreenNode => row({ spacing: 0 }, [flex(), child, flex()]);

const mini = (link: string): ScreenNode =>
  nd("playback-controls", { style: "mini", title: "Ep. 214: What rain sounds like on tin", art: 9, duration: 3300, elapsed: 1260, playing: false, link });

const episode = (eyebrow: string, title: string, meta: string, art: string, word: string, extra: Record<string, string | number | boolean> = {}): ScreenNode =>
  nd("media-row", { art, word, eyebrow, title, meta, metaIcon: "clock", detail: "", thumbSize: 56, trailing: "drag", swipe: true, progress: 0, ...extra });

/** Speed and sound for one scope: a stepper for speed, a bar for voice lift and a switch for gaps. */
const soundPage = (speed: number, voices: number, gaps: boolean, note: string): ScreenNode =>
  col({ spacing: 12 }, [
    col({ ...CARD, spacing: 4, padding: 12 }, [
      nd("decimal-stepper", { label: "Speed", symbol: "timer", value: speed, min: 0.5, max: 3, step: 0.1, decimals: 1, suffix: "×" }),
    ]),
    nd("expanding-track", { mode: "single", title: "Clearer voices", symbol: "speaker.wave.2", value: voices, min: 0, max: 100, step: 10, fill: "tangerine" }),
    col({ ...CARD, spacing: 4, padding: 12 }, [
      nd("toggle", { label: "Skip quiet gaps", isOn: gaps, tint: "accent" }),
      footnote(note),
    ]),
  ]);

export const build: CatalogBuilder = app({
  name: "Longwave",
  shell: "tabs", tabBar: "dock",
  look: "pieces",
  screens: (l) => [
    {
      key: "podcasts", name: "LibraryView", tab: { title: "Library", icon: "square.grid.2x2" },
      props: { title: "", alignment: "leading", padding: 16, spacing: 16 },
      children: [
        nd("screen-header", { eyebrow: "12 shows · 4 new episodes", title: "Library", emphasis: "on repeat", emphasisStyle: "muted", stacked: "yes", size: 34, trailing: "icon", icon: "slider.horizontal.3", link: l.sheet("effects"), leadWeight: "bold"}),
        nd("search-field", { placeholder: "Find a show or paste a feed link", showsCancel: false }),
        nd("tracking-tabs", { titles: "All, New, Offline", counts: "9, 6, 0", selected: 0, indicator: "tangerine" }, [
          col({ spacing: 12 }, [
            head("Shows", "9 followed"),
            nd("cover-grid", { titles: SHOWS.split(", ").slice(0, 9).join(", "), columns: 3, spacing: 8, radius: COVER, palette: "pieces", start: 0, link: l.sheet("player") }),
          ]),
          col({ spacing: 12 }, [
            head("New episodes", "6 shows"),
            nd("cover-grid", { titles: "Map Room, Ground Floor, Long Division, Weather Desk, Tin Roof, Half Light", columns: 3, spacing: 8, radius: COVER, palette: "pieces", start: 1, link: l.sheet("player") }),
          ]),
          col({ ...CARD, alignment: "center", spacing: 12, padding: 24 }, [
            centered(nd("symbol", { icon: "square.and.arrow.down", size: 22, color: "secondary", badge: "circle" })),
            nd("text", { text: "Nothing downloaded yet", style: "headline", alignment: "center" }),
            body("New episodes of the shows you follow can wait here for the tunnel.", { alignment: "center" }),
            nd("toast", { trigger: "Download new episodes", triggerStyle: "raised", fullWidth: false, message: "Downloading 4 episodes", detail: "They'll play offline in a minute", style: "info", icon: "square.and.arrow.down", actionTitle: "", position: "top", duration: 3 }),
          ]),
        ]),
        mini(l.sheet("player")),
      ],
    },
    {
      key: "player", name: "PlayerView", props: { title: "", spacing: 20, alignment: "center", padding: 20 },
      children: [
        nd("screen-header", { eyebrow: "Playing from your library", title: "Now playing", emphasis: "", stacked: "no", size: 34, trailing: "icon", icon: "chevron.down", link: "back", leadWeight: "bold"}),
        nd("cover-grid", { titles: "Tin Roof", columns: 1, spacing: 0, radius: 24, width: 248, glow: false, palette: "pieces", start: 9 }),
        col({ ...CARD, spacing: 12, padding: 20 }, [
          nd("playback-controls", { style: "full", title: "Ep. 214: What rain sounds like on tin", show: "Tin Roof · Field notes on sound", duration: 3300, elapsed: 1260, playing: true, skipBack: "15", skipForward: "45" }),
        ]),
        row({ spacing: 12 }, [
          nd("elastic-button", { title: "1.4×", icon: "timer", iconPosition: "leading", style: "raised", fullWidth: false, link: l.sheet("effects") }),
          nd("toast", { trigger: "Sleep", triggerStyle: "raised", fullWidth: false, message: "Sleep timer on", detail: "Stops at the end of this episode", style: "info", icon: "moon", actionTitle: "Undo", position: "top", duration: 3 }),
          nd("reaction-toggle", { icon: "bookmark", isOn: false, count: 3, confirmation: "Clip saved", fill: "tangerine", size: 26 }),
        ]),
      ],
    },
    {
      key: "effects", name: "SoundView", props: { title: "", spacing: 16, alignment: "leading", padding: 16, detent: "medium" },
      children: [
        nd("screen-header", { eyebrow: "Tin Roof", title: "Speed", emphasis: "and sound", emphasisStyle: "muted", stacked: "no", size: 34, trailing: "icon", icon: "xmark", link: "back", leadWeight: "bold"}),
        nd("tracking-tabs", { titles: "This show, Every show", counts: "", selected: 0, indicator: "tangerine" }, [
          soundPage(1.4, 40, true, "Shaved 42 minutes off this show's episodes this month."),
          soundPage(1.2, 20, false, "Shows without their own setting play like this."),
        ]),
      ],
    },
    {
      key: "playlist", name: "PlaylistView", tab: { title: "Playlists", icon: "list.bullet" },
      props: { title: "", spacing: 16, alignment: "leading", padding: 16 },
      children: [
        nd("screen-header", { eyebrow: "Playlist · 38 episodes", title: "Long drives", emphasis: "31 h 20 m", emphasisStyle: "muted", stacked: "yes", size: 34, trailing: "none", leadWeight: "bold"}),
        centered(nd("cover-grid", { titles: "Map Room, Slow Money, Weather Desk, Half Light", columns: 2, spacing: 0, radius: 24, width: 196, glow: false, palette: "pieces", start: 1 })),
        row({ spacing: 12 }, [
          nd("elastic-button", { title: "Play all", icon: "play.fill", iconPosition: "leading", style: "signal", fullWidth: true, link: l.sheet("player") }),
          nd("elastic-button", { title: "Shuffle", icon: "arrow.triangle.2.circlepath", iconPosition: "leading", style: "raised", fullWidth: true, link: l.sheet("player") }),
        ]),
        head("Episodes", "4 of 38"),
        col({ spacing: 4 }, [
          episode("Thursday", "The mapmaker who walked every street in her town", "52 min", "azure", "Map Room", { trailing: "play", swipe: false, trailingLink: l.sheet("player"), link: l.sheet("player") }),
          episode("Episode 61 · Monday", "Why small savings beat big plans", "18 min left", "sage", "Slow Money", { trailing: "play", swipe: false, progress: 64, trailingLink: l.sheet("player"), link: l.sheet("player") }),
          episode("3 May", "Forecasting fog for ferry captains", "44 min", "sky", "Weather Desk", { trailing: "play", swipe: false, trailingLink: l.sheet("player"), link: l.sheet("player") }),
          episode("S2 E9 · 28 April", "Dusk, streetlights and the blue hour", "37 min", "ink", "Half Light", { trailing: "play", swipe: false, trailingLink: l.sheet("player"), link: l.sheet("player") }),
        ]),
        mini(l.sheet("player")),
      ],
    },
    {
      key: "upnext", name: "QueueView", tab: { title: "Queue", icon: "rectangle.stack" },
      props: { title: "", spacing: 16, alignment: "leading", padding: 16 },
      children: [
        nd("screen-header", { eyebrow: "5 episodes", title: "Queue", emphasis: "for the drive home", emphasisStyle: "muted", stacked: "no", size: 34, trailing: "icon", icon: "play.fill", link: l.sheet("player"), leadWeight: "bold"}),
        col({ ...CARD, alignment: "center", spacing: 4, padding: 20 }, [
          caption("TIME LEFT", { weight: "semibold" }),
          centered(nd("odometer", { value: 242, currency: false, size: 60 })),
          footnote("minutes, about four hours of road", { alignment: "center" }),
        ]),
        col({ ...CARD, spacing: 4, padding: 12 }, [
          caption("NOW PLAYING", { weight: "semibold" }),
          episode("Today", "Ep. 214: What rain sounds like on tin", "34 min left", "lilac", "Tin Roof", { trailing: "chevron", swipe: false, progress: 38, link: l.sheet("player") }),
        ]),
        head("Up after this", "Swipe to remove"),
        col({ spacing: 4 }, [
          episode("12 May", "The last lighthouse keeper on the coast", "48 min", "sand", "Field Recording"),
          episode("Episode 88 · 11 May", "How a spreadsheet ran a small town", "22 min left", "ink", "Long Division", { progress: 55 }),
          episode("10 May", "Building a quieter dishwasher", "39 min", "ember", "Quiet Engines"),
          episode("Bonus · 2 May", "Listener questions, round four", "26 min", "butter", "Open Question"),
        ]),
        nd("hold-to-confirm", { title: "Hold to clear the queue", icon: "trash", committedTitle: "Queue cleared", style: "standard", duration: 1.2 }),
      ],
    },
  ],
});
