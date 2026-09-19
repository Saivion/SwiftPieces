import Link from "next/link";
import { LogoMark, Wordmark } from "@swiftpieces/brand";

export { LogoMark };

export function Logo({ className, withTag = false }: { className?: string; withTag?: boolean }) {
  return (
    <Link href="/" className={className} aria-label="Swift Pieces home">
      <Wordmark tag={withTag ? "Free" : undefined} />
    </Link>
  );
}
