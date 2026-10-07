"use client";
// Where a style goes, pinned under the studio's settings: its code (copy it, copy a link to it,
// paste one in, or see it as Swift: Theme.swift and the App root that wears it), a prompt that
// hands the whole design to an AI assistant, and straight into one of the free apps in the
// Playground.
import { useMemo, useRef, useState } from "react";
import { stylePrompt, styleSwift, type Theme } from "@swiftpieces/builder";
import { UI } from "@swiftpieces/builder/react";
import type { Studio } from "./studio-state";

export type StyleApp = { slug: string; name: string; icon: string; href: string };

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const tool = "ai-host grid size-7 flex-none place-items-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-white/[.08] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

export function StudioActions({ studio, apps, preferred, onNotice }: { studio: Studio; apps: StyleApp[]; preferred: string | null; onNotice: (text: string) => void }) {
  const swift = useRef<HTMLDialogElement>(null);
  const [pasting, setPasting] = useState(false);
  // The app the visitor came from (the Playground's palette button) goes first.
  const ordered = useMemo(() => [...apps].sort((a, b) => Number(b.slug === preferred) - Number(a.slug === preferred)), [apps, preferred]);
  const { code } = studio;
  return (
    <div className="flex-none border-t border-[var(--card-border)] p-3">
      {pasting ? (
        <form
          className="flex h-9 items-center gap-1 rounded-[var(--radius)] bg-[var(--studio-row)] pr-1 pl-3"
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get("code") ?? "");
            if (!studio.paste(value)) return onNotice("That isn't a style code.");
            onNotice("Style opened from its code.");
            setPasting(false);
          }}
        >
          <input name="code" autoFocus spellCheck={false} autoComplete="off" placeholder="Paste a code, SP2-…" aria-label="Style code" onKeyDown={(e) => e.key === "Escape" && setPasting(false)} className="h-full min-w-0 flex-1 bg-transparent font-mono text-[11.5px] text-foreground outline-none placeholder:text-subtle" />
          <button type="submit" className={tool} aria-label="Open the style" title="Open (Return)">
            <UI name="check" size={13} />
          </button>
          <button type="button" className={tool} aria-label="Cancel" title="Cancel (Esc)" onClick={() => setPasting(false)}>
            <UI name="close" size={12} />
          </button>
        </form>
      ) : (
        <div className="flex h-9 items-center gap-0.5 rounded-[var(--radius)] bg-[var(--studio-row)] pr-1 pl-3" title="This style as a code: paste it into the Style tab of any Playground">
          <span className="sr-only">Style code</span>
          <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground tabular-nums">{code}</code>
          <button type="button" className={tool} aria-label="Copy the style code" title="Copy the style code" onClick={async () => onNotice((await copy(code)) ? "Code copied. Paste it into any Playground's Style tab." : "Couldn't copy. Select the code and copy it.")}>
            <UI name="copy" size={13} />
          </button>
          <button type="button" className={tool} aria-label="Copy a link to this style" title="Copy a link to this style" onClick={async () => onNotice((await copy(`${window.location.origin}/styles?style=${code}`)) ? "Link copied." : "Couldn't copy the link.")}>
            <UI name="link" size={13} />
          </button>
          <button type="button" className={tool} aria-label="Paste a style code" title="Paste a style code" onClick={() => setPasting(true)}>
            <UI name="paste" size={13} />
          </button>
          <button type="button" className={tool} aria-label="Swift for this style" title="Swift for this style: Theme.swift" onClick={() => swift.current?.showModal()}>
            <UI name="code" size={13} />
          </button>
        </div>
      )}
      {/* A narrow panel (under 316px) keeps "Open in the Playground" whole and shows the prompt as its icon. */}
      <div className="@container mt-1.5 flex gap-1.5">
        <button
          type="button"
          aria-label="Copy prompt"
          title="Copy a prompt that gives an AI assistant this whole design: colors, fonts, shape, spacing, motion and Theme.swift"
          onClick={async () => {
            const prompt = stylePrompt(studio.theme, { code, link: `${window.location.origin}/styles?style=${code}`, mood: studio.mood?.id, swift: styleSwift(studio.theme, "My").theme });
            onNotice((await copy(prompt)) ? "Prompt copied. Paste it into your AI assistant, then say what to build." : "Couldn't copy the prompt.");
          }}
          className="ai-host inline-flex h-9 flex-none items-center justify-center gap-1.5 rounded-[var(--radius)] bg-[var(--studio-row)] px-2.5 text-[12.5px] font-semibold whitespace-nowrap text-foreground transition-colors hover:bg-[var(--studio-row-hover)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent @[316px]:px-3"
        >
          <UI name="prompt" size={14} />
          <span aria-hidden className="hidden @[316px]:inline">
            Copy prompt
          </span>
        </button>
        <OpenMenu apps={ordered} code={code} />
      </div>
      <SwiftDialog ref={swift} theme={studio.theme} onNotice={onNotice} />
    </div>
  );
}

/** Open in the Playground: the free apps, each opening with this style on every screen. */
function OpenMenu({ apps, code }: { apps: StyleApp[]; code: string }) {
  const first = apps[0];
  if (!first) return null;
  return (
    <details className="group/open relative flex-1">
      <summary className="btn-solid ai-host flex h-9 cursor-pointer list-none items-center justify-center gap-2 rounded-[var(--radius)] px-3 text-[12.5px] font-semibold [&::-webkit-details-marker]:hidden">
        Open in the Playground
        <svg aria-hidden viewBox="0 0 16 16" className="size-3 transition-transform duration-200 group-open/open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="absolute right-0 bottom-full left-0 z-20 mb-1.5 rounded-[var(--radius-lg)] bg-[var(--studio-row)] p-1 shadow-[0_18px_40px_-12px_rgb(0_0_0/.8)] ring-1 ring-white/10">
        {apps.map((a) => (
          <a key={a.slug} href={`${a.href}?style=${encodeURIComponent(code)}`} className="flex items-center gap-2.5 rounded-[var(--radius)] px-2 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-white/[.07]">
            <img src={a.icon} alt="" width={22} height={22} className="size-[22px] rounded-[6px]" />
            {a.name}
          </a>
        ))}
      </div>
    </details>
  );
}

/**
 * The style as Swift: Theme.swift exactly as an exported Playground app has it, and an App whose
 * root wears the style. A modal <dialog>: Escape and the backdrop close it, focus stays inside.
 */
function SwiftDialog({ ref, theme, onNotice }: { ref: React.Ref<HTMLDialogElement>; theme: Theme; onNotice: (text: string) => void }) {
  const [tab, setTab] = useState<"theme" | "app">("theme");
  const files = useMemo(() => styleSwift(theme, "My"), [theme]);
  const text = tab === "theme" ? files.theme : files.app;
  const name = tab === "theme" ? "Theme.swift" : "MyApp.swift";
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/x-swift" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <dialog
      ref={ref}
      aria-label="Swift for this style"
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="studio-dark m-auto w-[min(760px,calc(100vw-32px))] max-w-none overflow-hidden rounded-[var(--radius-lg)] border border-[var(--card-border)] bg-[var(--studio-panel)] p-0 text-foreground shadow-[0_40px_120px_-30px_rgb(0_0_0/.85)] backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--card-border)] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold">Swift for this style</h2>
          <p className="mt-1 max-w-[54ch] text-[12.5px] leading-relaxed text-muted">
            Apps you build from the Playground already include Theme.swift. For an app of your own, add Theme.swift to the project and give your App the root below: every view under it follows the style.
          </p>
        </div>
        <form method="dialog">
          <button aria-label="Close" className={tool}>
            <UI name="close" size={14} />
          </button>
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <div role="tablist" aria-label="File" className="flex rounded-[var(--radius)] bg-[var(--studio-row)] p-[3px]">
          {(
            [
              ["theme", "Theme.swift"],
              ["app", "MyApp.swift"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className="h-7 rounded-[var(--radius)] px-3 font-mono text-[11.5px] text-muted transition-colors hover:text-foreground aria-selected:bg-white/[.12] aria-selected:text-foreground">
              {label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button type="button" onClick={async () => onNotice((await copy(text)) ? `${name} copied.` : "Couldn't copy.")} className="ai-host inline-flex h-8 items-center gap-1.5 rounded-[var(--radius)] bg-[var(--studio-row)] px-3 text-[12px] font-semibold transition-colors hover:bg-[var(--studio-row-hover)]">
          <UI name="copy" size={13} />
          Copy
        </button>
        <button type="button" onClick={download} className="btn-solid ai-host inline-flex h-8 items-center gap-1.5 rounded-[var(--radius)] px-3 text-[12px] font-semibold">
          <UI name="download" size={13} />
          Download
        </button>
      </div>
      <pre className="m-5 max-h-[min(56vh,520px)] overflow-auto rounded-[var(--radius-lg)] bg-[var(--studio-row)] p-4 font-mono text-[12px] leading-[1.6] text-foreground [scrollbar-width:thin]">
        <code>{text}</code>
      </pre>
    </dialog>
  );
}
