"use client";
// The Free playground's link to the Pro site. No Clerk and no cookies here: a hidden frame of the
// Pro site's /embed/session page mints a short-lived session token on *its* origin and hands it to
// this page by postMessage; requests then go to Pro's API with `Authorization: Bearer` and
// `credentials: "omit"`. The Pro server verifies the token, the account's Pro access and ownership on
// every request, so nothing here decides what anyone may do; it only shows or hides the way in.
//
// Loaded only by the playground (components/playground/*), never by the marketing pages.
import { useEffect, useState } from "react";
import { acceptTokenReply, isAllowedProPath, isReadySignal, requestId, tokenExpiry } from "./pro-bridge-core";
import { site } from "./site";

/** The Pro site: the local Pro server in development, else pro.swiftpieces.com. */
export const proOrigin = new URL(process.env.NEXT_PUBLIC_PRO_EMBED_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3200" : site.proUrl)).origin;

const TIMEOUT_MS = 8000;
let frame: HTMLIFrameElement | null = null;
let ready: Promise<Window> | null = null;
let cached: { token: string; until: number } | null = null;

/** The hidden token page, loaded once, resolved when it says it's ready. */
function tokenPage(): Promise<Window> {
  if (ready) return ready;
  ready = new Promise<Window>((resolve, reject) => {
    frame = document.createElement("iframe");
    frame.src = `${proOrigin}/embed/session`;
    frame.title = "SwiftPieces Pro session";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    const timer = window.setTimeout(() => done(new Error("timeout")), TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      if (frame?.contentWindow && isReadySignal(event, { origin: proOrigin, source: frame.contentWindow })) done(null);
    };
    function done(err: Error | null) {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (err || !frame?.contentWindow) {
        frame?.remove();
        frame = null;
        ready = null;
        reject(err ?? new Error("no frame"));
      } else resolve(frame.contentWindow);
    }
    window.addEventListener("message", onMessage);
    document.body.appendChild(frame);
  });
  return ready;
}

/** A session token for the Pro API, or null when signed out (or the Pro site can't be reached). */
export async function proToken(fresh = false): Promise<string | null> {
  if (!fresh && cached && Date.now() < cached.until) return cached.token;
  cached = null;
  let win: Window;
  try {
    win = await tokenPage();
  } catch {
    return null;
  }
  const id = requestId();
  return new Promise<string | null>((resolve) => {
    const timer = window.setTimeout(() => finish(null), TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      const reply = acceptTokenReply(event, { origin: proOrigin, source: win, id });
      if (reply !== undefined) finish(reply);
    };
    function finish(token: string | null) {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (token) cached = { token, until: tokenExpiry(token) };
      resolve(token);
    }
    window.addEventListener("message", onMessage);
    win.postMessage({ type: "sp:token-request", id }, proOrigin);
  });
}

/**
 * A request to one of the few Pro API routes this site may call, with the session token. A 401 (an
 * expired or revoked token) is retried once with a fresh one. Signed out: a 401 without a request.
 */
export async function proFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!isAllowedProPath(path)) throw new Error("Not a Pro API path this site may call");
  const signedOut = () => new Response(JSON.stringify({ error: "sign_in_required" }), { status: 401, headers: { "content-type": "application/json" } });
  const send = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    return fetch(`${proOrigin}${path}`, { ...init, headers, credentials: "omit", cache: "no-store", mode: "cors", referrerPolicy: "strict-origin" });
  };
  const token = await proToken();
  if (!token) return signedOut();
  const res = await send(token);
  if (res.status !== 401) return res;
  // The token was refused (expired or revoked since it was cached): one retry with a fresh one.
  const fresh = await proToken(true);
  return fresh ? send(fresh) : signedOut();
}

export type ProSession = "checking" | "signed-out" | "free" | "pro";

let session: Promise<Exclude<ProSession, "checking">> | null = null;
const HINT_KEY = "sp:plan";

/**
 * Who the visitor is on the Pro site: asked once per page, by whoever asks first (the playground's
 * loader starts it before the Playground's own code arrives, so the two load side by side). Any
 * failure reads as signed out.
 */
export function proSession(): Promise<Exclude<ProSession, "checking">> {
  session ??= proFetch("/api/session")
    .then((r) => (r.ok ? (r.json() as Promise<{ signedIn?: boolean; pro?: boolean }>) : null))
    .then((s): Exclude<ProSession, "checking"> => (!s?.signedIn ? "signed-out" : s.pro ? "pro" : "free"))
    .catch(() => "signed-out" as const)
    .then((answer) => {
      try {
        localStorage.setItem(HINT_KEY, answer);
      } catch {}
      return answer;
    });
  return session;
}

/**
 * What the last check here said, before this page's check answers: only a hint, never trusted for
 * access (the Pro server decides every request). The playground uses it to start loading a Pro
 * owner's screens alongside the check instead of after it.
 */
export function proSessionHint(): Exclude<ProSession, "checking"> | null {
  try {
    const v = localStorage.getItem(HINT_KEY);
    return v === "pro" || v === "free" || v === "signed-out" ? v : null;
  } catch {
    return null;
  }
}

/** The visitor's plan for a component: "checking" until this page's check answers. */
export function useProSession(): ProSession {
  const [state, setState] = useState<ProSession>("checking");
  useEffect(() => {
    let live = true;
    void proSession().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** Sign in on the Pro site, then come back here. */
export const proSignInUrl = (returnTo: string) => `${proOrigin}/sign-in?redirect_url=${encodeURIComponent(returnTo)}`;
/** Create an account on the Pro site, then come back here. */
export const proSignUpUrl = (returnTo: string) => `${proOrigin}/sign-up?redirect_url=${encodeURIComponent(returnTo)}`;
