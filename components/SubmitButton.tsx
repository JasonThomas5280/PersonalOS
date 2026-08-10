"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that reports the form's pending state.
 *
 * Every page is force-dynamic and every action revalidates the whole layout, so
 * a save is a full server round trip. Without this the button never changes and
 * "saved" is indistinguishable from "my click didn't register" — which also
 * invites the double-click that double-toggles a session.
 *
 * useFormStatus reads the nearest enclosing <form>, so this must be rendered as
 * a child of the form it submits, not alongside it.
 */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "btn",
  title,
}: {
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      title={title}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Icon-only submit (the ✓/○ toggles and × removals). `label` becomes the
 * accessible name — the glyph alone announces as "×" with no indication of what
 * it acts on.
 */
export function IconSubmit({
  glyph,
  label,
  className,
}: {
  glyph: string;
  label: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{pending ? "…" : glyph}</span>
    </button>
  );
}
