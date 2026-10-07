"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Catalog, CatalogEntry } from "../../core/catalog.js";
import type { ComponentRegistry } from "../../core/registry.js";
import type { BuilderEventName } from "../../core/events.js";
import type { BuilderLimits, Project, ScreenNode, SwiftPieceDefinition } from "../../core/schema.js";
import type { SourceResolver } from "../../export/index.js";
import type { PlayStore } from "./store.js";

export type EventProps = Record<string, string | number>;

/**
 * Everything the site provides. The Playground never talks to a network, an auth system or an
 * analytics vendor directly; Free and Pro plug theirs in here and share every line of the runtime.
 */
export type PlaygroundHost = {
  /** "SwiftPieces" or "SwiftPieces Pro". */
  product: string;
  limits: BuilderLimits;
  registry: ComponentRegistry;
  catalog: Catalog;
  /** Where entries live: "/playground" on Free, "/builder" on Pro. */
  basePath: string;
  /** Fetches component sources for downloads and Xcode. */
  resolveSource: SourceResolver;
  track?: (event: BuilderEventName, props?: EventProps) => void;
  /** Local storage namespace, so Free and Pro keep separate remixes. */
  storageKey: string;
  links: {
    /** Where "Get Pro" goes. */
    pro: string;
    /** The component's page on this site, or null when it has none. */
    component: (def: SwiftPieceDefinition) => string | null;
    /** Installation guide. */
    install: string;
    /** "Open in Xcode" Git URL for a project encoded with `encodeProject`. Absent: no button. */
    xcodeRepo?: (blob: string, appName: string) => string;
    /** The Build sheet's step onward: carries the remix to another playground (Free → Pro for owners), or
     *  points everyone else at Pro. `blob` is the encoded remix, null while encoding or when too large. */
    handoff?: {
      label: string;
      desc: string;
      url: (blob: string | null) => string;
      /** Its icon (the Pro crown, say); an arrow out when absent. */
      icon?: "crown" | "external";
      /** The host's artwork drawn behind this one card (Free: its dithered field), so it stands apart. */
      backdrop?: ReactNode;
    };
    /**
     * The page an entry lives on, when it isn't `basePath/<kind>/<slug>`. Share links use it, opening
     * an entry in place puts it in the address bar, and Back and Forward find the entry by it.
     */
    entryPath?: (entry: CatalogEntry) => string;
    /** The document title for an entry opened in place, when the host titles its pages its own way. */
    entryTitle?: (entry: CatalogEntry) => string;
    /** Sign in, with a return URL. With `cloudSave`, it's where Save sends people who aren't signed in. */
    signIn?: (returnTo: string) => string;
    /** Create an account, with a return URL (the Save popup offers it beside sign-in). */
    signUp?: (returnTo: string) => string;
    /**
     * The host's page for making a style (Free: /styles), opened on the style the Style tab shows,
     * given as its code. Absent: the Style tab has no button for it.
     */
    styles?: (code: string) => string;
  };
  /** The top bar's back button (docked layout): where it goes and what it says it goes back to. */
  back?: { href: string; label: string };
  /** The site mark in the top bar, linking home. */
  brand?: { href: string; name: string; mark?: ReactNode };
  /**
   * The site's colour artwork (Free: the dithered field its landing cards stand on), filling the
   * colour side of the Build dialog. Absent: a soft gradient in the accent.
   */
  art?: ReactNode;
  /**
   * The breadcrumb after the mark, in place of "Playground / kind / entry" (an app library host
   * shows "Apps / Lungy / Breathing App"). The last item is the current page.
   */
  crumbs?: Array<{ label: string; href?: string }>;
  /**
   * The left panel, in place of Explore. A host that opens one thing (an app's screens, not the
   * catalog) draws its own; the Playground then never switches entries on its own. `label` names
   * it on the small-screen bar. Rendered inside the Playground, so it can use `usePlayground`.
   */
  sidebar?: { label: string; render: () => ReactNode; footer?: () => ReactNode };
  /**
   * The stage for an entry this plan doesn't open (Free's view of a Pro app): what it is and what
   * unlocks it, drawn by the host. Absent, a generic card (Locked.tsx). Rendered inside the
   * Playground, so it can use `usePlayground`. When the plan changes to one that opens the entry,
   * the entry opens in its place (the store's setLimits).
   */
  lockedStage?: (entry: CatalogEntry) => ReactNode;
  /**
   * Drawn centered at the top of the stage, above the screens, for whatever is open (Free: the app's
   * icon and name), running or locked. The stage keeps room for it.
   */
  stageBadge?: (entry: CatalogEntry) => ReactNode;
  /**
   * Told the open entry whenever it changes (opened in place, or by Back and Forward), so the host's
   * own parts can follow it: its sidebar, breadcrumb, back link and fine print.
   */
  onEntry?: (entry: CatalogEntry | null) => void;
  /**
   * "workspace" (default): the Playground is the whole window, with its own top bar and the
   * inspector as a right column. "docked": laid out like the host's docs, as inset panels: a top
   * bar panel (back, mark, breadcrumb, Interact / Inspect, restart, appearance, undo, redo, Build),
   * one left panel holding the sidebar and the inspector as tabs, and the stage; no right column.
   */
  layout?: "workspace" | "docked";
  /**
   * Composing across entries (docked layout): a Screens tab lists every entry's screens to add,
   * replace or drag in, and a Style tab restyles the whole project. `source` names an entry in that
   * library (usually the app it recreates) and orders it; returning null leaves the entry out. An
   * entry this plan doesn't open is listed after the rest as a row that links to its `href`.
   * `art` is a picture for one of its screens (the App Store screenshot it answers), when there is one,
   * about `width` CSS pixels wide (the stage's inspiration card asks for bigger ones than the cards).
   */
  compose?: {
    /**
     * false: no library of screens to add. The Screens tab is the host's sidebar alone (labeled with
     * its `label`), and the screen bar under the phone has no "+".
     */
    library?: boolean;
    /** `tags`: search words for each of the entry's screens, in step order ("timer", "calendar"). */
    source(entry: CatalogEntry): { title: string; subtitle?: string; icon?: string; rank?: number; href?: string; tags?: string[][] } | null;
    art?(entry: CatalogEntry, step: number, width?: number): string | null;
  };
  /** Whether the visitor is signed in and owns Pro, when the host knows. */
  session?: { signedIn: boolean; pro: boolean } | null;
  /**
   * Pro: ask for a remix in words ("make it feel more native"). Gets the current screen's tree and
   * returns a new tree, which is validated like any other input before it touches the preview.
   */
  remixWithAI?: (prompt: string, screen: ScreenNode, context: { entry: string }) => Promise<unknown>;
  /**
   * Keep a remix in the visitor's account (present when they're signed in). The top bar's Save uses
   * it; signed out, Save opens a popup to sign in or create an account (`links.signIn`/`signUp`).
   * Throws with a message to show when the save is refused (a full account, say).
   */
  cloudSave?: (project: Project, title: string) => Promise<{ id: string; url?: string }>;
  /** How many remixes the account keeps, for the Save popup's copy ("Free accounts keep 5"). */
  saveLimits?: { free: number; pro: number };
  /** A card the host draws for Pro pitches (the site's own Pro card). */
  proCard?: (context: { title: string; body: string; href: string }) => ReactNode;
};

export type PlaygroundContextValue = {
  store: PlayStore;
  host: PlaygroundHost;
  track(event: BuilderEventName, props?: EventProps): void;
  /** Opens an entry from the explorer, keeping the URL in step. */
  navigate(kind: string, slug: string, opts?: { replace?: boolean; select?: string }): void;
};

export const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

export function usePlayground(): PlaygroundContextValue {
  const ctx = useContext(PlaygroundContext);
  if (!ctx) throw new Error("usePlayground outside <Playground>");
  return ctx;
}

export type { Catalog, ComponentRegistry };
