import { site } from "@/lib/site";

/** Star count for the public repo, cached for 5 minutes to match the homepage revalidate. Returns null when GitHub is unreachable or the repo is not public yet. */
export async function getStarCount(): Promise<number | null> {
  const repo = site.github.replace("https://github.com/", "");
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "swiftpieces.com" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

/** 1234 -> "1.2K", 47210 -> "47.2K", 1200000 -> "1.2M". */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
