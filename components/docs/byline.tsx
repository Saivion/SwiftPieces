import Link from "next/link";
import lastmod from "@/registry/__registry__/lastmod.json";
import { AUTHOR } from "@/lib/seo";

const dated = lastmod as Record<string, string>;

/** The page's last real change (registry/__registry__/lastmod.json), as "Nov 10, 2026". */
export function lastUpdated(path: string): string | null {
  const d = dated[path];
  return d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;
}

/** "By Saivion · Updated Nov 10, 2026" under a guide's or a component's description. The date moves only when the content does. */
export function Byline({ path }: { path: string }) {
  const updated = lastUpdated(path);
  const iso = dated[path];
  return (
    <p className="not-prose -mt-2 mb-8 text-[13px] text-subtle">
      By{" "}
      <Link href={AUTHOR.path} rel="author" className="u-link font-semibold text-foreground">
        {AUTHOR.name}
      </Link>
      {updated ? (
        <>
          {" · "}Updated <time dateTime={iso}>{updated}</time>
        </>
      ) : null}
    </p>
  );
}
