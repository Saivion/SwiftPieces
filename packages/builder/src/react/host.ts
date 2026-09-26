import type { ComponentRegistry, TemplateRegistry } from "../index.js";
import type { BuilderLimits, Project } from "../core/schema.js";
import type { SourceResolver } from "../export/index.js";

/** Product events. Names only, plus small enums: never the project, never text people typed. */
export type BuilderEvent =
  | "builder_opened" | "component_selected" | "component_customized" | "screen_created" | "template_selected"
  | "export_clicked" | "code_copied" | "project_downloaded" | "signup_started" | "signup_completed" | "pro_cta_clicked"
  | "onboarding_answered" | "explain_opened" | "describe_used" | "builder_error" | "builder_perf";

export type EventProps = Record<string, string | number>;

/** A saved project in the account (Pro). */
export type CloudProject = { id: string; name: string; updatedAt: number };

/**
 * Everything the app provides. The builder never talks to a network, an auth system or an
 * analytics vendor directly; Free and Pro plug theirs in here.
 */
export type BuilderHost = {
  /** "SwiftPieces" or "SwiftPieces Pro": shown in the toolbar and exports. */
  product: string;
  limits: BuilderLimits;
  registry: ComponentRegistry;
  templates: TemplateRegistry;
  /** Locked teasers to list in Free, e.g. Pro components (name + one line). */
  locked?: Array<{ id: string; name: string; description: string }>;
  /** Fetches component sources at export time. */
  resolveSource: SourceResolver;
  track?: (event: BuilderEvent, props?: EventProps) => void;
  links: {
    /** Where "Get Pro" goes. */
    pro: string;
    /** Absolute or site-relative docs URL for a definition's `docs` path. */
    docs: (path: string) => string;
    /** Sign in, with a return URL. */
    signIn?: (returnTo: string) => string;
    /** Installation guide. */
    install: string;
  };
  /** Local storage namespace, so Free and Pro keep separate drafts. */
  storageKey: string;
  /** Natural-language screen creation. Absent → the builder uses its local matcher. */
  describe?: (prompt: string, context: { components: string[]; templates: string[] }) => Promise<unknown>;
  /** Account persistence (Pro). */
  cloud?: {
    list(): Promise<CloudProject[]>;
    load(id: string): Promise<unknown>;
    save(project: Project): Promise<{ id: string }>;
    remove(id: string): Promise<void>;
  };
  /** Whether the visitor is signed in, when the host knows. */
  session?: { signedIn: boolean; pro: boolean } | null;
};

/** Deep-link parameters read from the URL. */
export type BuilderEntry = { component?: string | null; template?: string | null; projectId?: string | null };
