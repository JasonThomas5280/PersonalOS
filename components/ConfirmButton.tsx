"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Two-step destructive submit.
 *
 * Deleting a person takes their whole contribution ledger and every commitment
 * with it; deleting a RAID item destroys a decision record whose entire purpose
 * is permanence. None of it was confirmed, and the delete buttons were the
 * smallest controls on the card.
 *
 * Inline rather than window.confirm so it stays in the visual language and
 * doesn't block the tab. Arms for `revertAfterMs`, then goes back to resting —
 * an armed button left on screen is its own hazard.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Confirm delete",
  className,
  label,
  revertAfterMs = 4000,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  className: string;
  /** Accessible name — "Delete" alone doesn't say which record. */
  label: string;
  revertAfterMs?: number;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), revertAfterMs);
    return () => clearTimeout(timer.current);
  }, [armed, revertAfterMs]);

  if (pending) {
    return (
      <button type="submit" className={className} disabled aria-busy="true">
        Deleting…
      </button>
    );
  }

  if (!armed) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => setArmed(true)}
        aria-label={label}
      >
        {children}
      </button>
    );
  }

  return (
    <>
      <button type="submit" className={className} aria-label={`${label} — confirm`} autoFocus>
        {confirmLabel}
      </button>
      <button type="button" className="btnGhost" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </>
  );
}
