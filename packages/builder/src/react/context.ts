"use client";
import { createContext, useContext } from "react";
import type { BuilderEvent, BuilderHost, EventProps } from "./host.js";
import type { Persona, Store } from "./store.js";

export type BuilderContextValue = {
  store: Store;
  host: BuilderHost;
  persona: Persona;
  setPersona(p: Persona): void;
  track(event: BuilderEvent, props?: EventProps): void;
  /** Opens the glossary for one or more concept ids. */
  explain(conceptIds: string | string[]): void;
  /** Opens a dialog by name. */
  open(dialog: "export" | "templates" | "describe" | "onboarding" | "projects" | null): void;
};

export const BuilderContext = createContext<BuilderContextValue | null>(null);

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder outside <Builder>");
  return ctx;
}

/** Whether beginner explanations show. SwiftUI developers never see them. */
export const showsHelp = (p: Persona) => p === "first-app" || p === "web";
