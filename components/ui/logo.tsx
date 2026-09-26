import Link from "next/link";
import { LogoMark, Wordmark } from "@swiftpieces/brand";

export { LogoMark };

/** The navbar lockup, one step smaller than the brand package default (17px name, 24px mark). */
export function Logo({ className, withTag = false }: { className?: string; withTag?: boolean }) {
  return (
    <Link href="/" className={className} aria-label="Swift Pieces home">
      <Wordmark tag={withTag ? "Free" : undefined} className="[&>img]:size-[22px] [&>span:first-of-type]:text-[15.5px] [&_.wordmark-tag]:text-[15px]" />
    </Link>
  );
}
