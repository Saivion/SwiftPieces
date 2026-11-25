import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The statement's type: one sentence, set a step under a page title so it holds two lines. */
export const statementTitle = "max-w-[920px] text-[30px] leading-[1.12] font-normal tracking-[-0.034em] text-balance sm:text-[38px] lg:text-[44px] lg:tracking-[-0.04em]";

/**
 * The page header (2026-11-25, Pro's "Statement", picked by Saivion for /library on 2026-11-24): no
 * eyebrow and no lead, one h1 in two tones, what is here in ink and the promise in grey. The filters
 * or the content sit right under it (`statementGap`). Kept identical to Pro's
 * components/library/statement.tsx.
 */
export function Statement({ children, quiet, className, as: Tag = "h1" }: { children: ReactNode; quiet?: ReactNode; className?: string; as?: "h1" | "h2" }) {
  return (
    <Tag className={cn(statementTitle, className)}>
      {children}
      {quiet ? <> <span className="text-subtle">{quiet}</span></> : null}
    </Tag>
  );
}

/** The section padding above a statement and the space between it and what follows. */
export const statementSection = "pt-10 md:pt-14";
export const statementGap = "mt-8 md:mt-10";
