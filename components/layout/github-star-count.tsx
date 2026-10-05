"use client";
import { useEffect, useState } from "react";
import { GitHubStar } from "@/components/layout/github-star";

/** The latest count this tab has seen, shared by both pills and kept across client navigations. */
let latest: number | null = null;
let request: Promise<number | null> | null = null;

function liveStars(): Promise<number | null> {
  request ??= fetch("/api/stars")
    .then((res) => (res.ok ? (res.json() as Promise<{ stars: number | null }>) : { stars: null }))
    .then(({ stars }) => (typeof stars === "number" ? (latest = stars) : latest))
    .catch(() => latest)
    .finally(() => setTimeout(() => (request = null), 60_000));
  return request;
}

/** Paints the count baked into the page, then moves to the live one from /api/stars. */
export function GitHubStarCount({ initial, className }: { initial: number | null; className?: string }) {
  const [stars, setStars] = useState(latest ?? initial);
  useEffect(() => {
    let live = true;
    void liveStars().then((n) => live && n !== null && setStars(n));
    return () => {
      live = false;
    };
  }, []);
  return <GitHubStar stars={stars} className={className} />;
}
