/**
 * The page's ground, in three quiet layers: a wash that lifts the top of the page, a fine dot
 * field that fades out as it falls, and the 12 column guides. All fixed, so the ground stays put
 * while content scrolls over it. Sections used to carry their own copies, which restarted the
 * pattern at every edge. Place inside a `relative` parent, before the content.
 */
export function PageBackdrop({ columns = 12 }: { columns?: number }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      {/* Ambient light from above, with the brand's red barely present at the top right. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-15%,rgb(255_255_255/0.045),transparent_60%),radial-gradient(45%_40%_at_88%_-5%,rgb(255_0_0/0.05),transparent_70%)]" />
      {/* The dot field: finer and quieter than a flat grid, strongest under the fold's top edge
          and gone by the bottom, so the page has a direction instead of reading as graph paper. */}
      <div className="dots-ambient absolute inset-0 [mask-image:linear-gradient(to_bottom,rgb(0_0_0/0.85)_0%,rgb(0_0_0/0.55)_45%,transparent_92%)]" />
      {/* Alignment lines: just visible, so content reads as sitting on a grid. */}
      <div className="absolute inset-0 mx-auto hidden w-full max-w-[var(--container)] px-5 sm:px-8 lg:block lg:px-12 2xl:px-16">
        <div className="grid h-full gap-4 [mask-image:linear-gradient(to_bottom,rgb(0_0_0/0.9)_0%,rgb(0_0_0/0.45)_60%,transparent_95%)]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-full border-l border-line/70 last:border-r" />
          ))}
        </div>
      </div>
    </div>
  );
}
