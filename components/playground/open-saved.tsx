"use client";
import { useEffect, useState } from "react";
import { savedRemixPath } from "@/lib/playground";
import { proFetch, proSignInUrl } from "@/lib/pro-bridge";

/**
 * /playground/open#cloud=<id>: the Pro account's Saved list links here. The saved remix is asked
 * for with the visitor's own token (the Pro server only returns their own), then they're sent to the
 * page it belongs to (its app's playground), which opens it. The id
 * travels in the fragment, so it never reaches a server log.
 */
export function OpenSaved() {
  const [state, setState] = useState<"opening" | "signed-out" | "missing">("opening");
  useEffect(() => {
    const id = /[#&]cloud=(bp_[a-z0-9]{8,32})(?:&|$)/.exec(window.location.hash)?.[1];
    if (!id) return setState("missing");
    proFetch(`/api/builder/projects/${id}`)
      .then(async (r) => {
        if (r.status === 401) return setState("signed-out");
        const project = r.ok ? ((await r.json()) as { entry?: unknown }) : null;
        const path = project ? savedRemixPath(project) : null;
        if (!path) return setState("missing");
        window.location.replace(`${path}#cloud=${id}`);
      })
      .catch(() => setState("missing"));
  }, []);
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center" role="status">
      {state === "opening" ? (
        <p className="text-[14px] text-muted">Opening your remix…</p>
      ) : state === "signed-out" ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-[14px] text-muted">Sign in to open your saved remix.</p>
          <a className="text-[14px] font-medium text-foreground underline underline-offset-2" href={proSignInUrl(window.location.href)}>Sign in</a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-[14px] text-muted">That remix couldn&apos;t be found in your account.</p>
          <a className="text-[14px] font-medium text-foreground underline underline-offset-2" href="/apps">Browse the App Library</a>
        </div>
      )}
    </div>
  );
}
