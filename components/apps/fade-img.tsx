"use client";
import { useCallback, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * An image that fades in once it has decoded, over a quiet placeholder of its own size, so a grid
 * of remote screenshots settles in together instead of painting line by line. Already-cached
 * images (the ref sees `complete`) show at once.
 */
export function FadeImg({ className, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [shown, setShown] = useState(false);
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth) setShown(true);
  }, []);
  return (
    <img
      ref={ref}
      alt={alt}
      decoding="async"
      onLoad={() => setShown(true)}
      {...props}
      className={cn("bg-[var(--surface-muted)] transition-opacity duration-500 ease-out", shown ? "opacity-100" : "opacity-0", className)}
    />
  );
}
