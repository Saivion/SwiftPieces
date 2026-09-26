const paths: Record<string, string> = {
  components: "M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z",
  blocks: "M2.5 4.5h11v3h-11zM2.5 9.5h5v3h-5zM9.5 9.5h4v3h-4z",
  screens: "M4 2.5h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM6 12h4",
  templates: "M2.5 3.5h11v2h-11zM2.5 7.5h11v5h-11z",
  agent: "M8 2l1.2 3.3L12.5 6.5 9.2 7.8 8 11 6.8 7.8 3.5 6.5l3.3-1.2z",
  free: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM5.5 8h5",
  collections: "M3 5.5h10M3 8h10M3 10.5h6M5.5 3v10",
  library: "M3 2.5h3v11H3zM7.5 2.5h3v11h-3zM11.5 3.2l2 .5-2.4 10-2-.5z",
};

/** Bare 16px glyph. Fumadocs supplies the icon container in the section switcher, so this must not add its own box. */
export function SectionIcon({ kind }: { kind: keyof typeof paths }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="m-0.5 block size-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d={paths[kind]} />
    </svg>
  );
}

/** Section name with a quiet count (or a short word such as "Pro"). */
export function TabTitle({ label, count }: { label: string; count: number | string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      {label}
      <span className="text-[11.5px] font-normal text-subtle">{count}</span>
    </span>
  );
}
