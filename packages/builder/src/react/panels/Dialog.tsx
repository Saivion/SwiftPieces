"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { UI } from "../icons.js";

/**
 * A native modal <dialog>: the browser handles the focus trap, Escape and the inert background,
 * with no library. Focus returns to whatever opened it.
 */
export function Dialog({ open, onClose, title, description, children, wide }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      const opener = document.activeElement as HTMLElement | null;
      d.showModal();
      return () => opener?.focus?.();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`spb-dialog${wide ? " is-wide" : ""}`}
      aria-labelledby="spb-dialog-title"
      onClose={onClose}
      onCancel={(e) => (e.preventDefault(), onClose())}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open ? (
        <div className="spb-dialog-inner">
          <header className="spb-dialog-head">
            <div>
              <h2 id="spb-dialog-title">{title}</h2>
              {description ? <p className="spb-muted">{description}</p> : null}
            </div>
            <button type="button" className="spb-icon-btn" onClick={onClose} aria-label="Close"><UI name="close" /></button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
