"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Safety net. Server actions enforce rules by throwing (see app/actions.ts —
 * closing a RAID item without a resolution note), and without a boundary the
 * user got an unstyled Next.js error page and lost every unsaved edit.
 *
 * Individual rules should still be caught client-side before submit; this is
 * what's left when one isn't.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12, maxWidth: 620 }}>
      <div>
        <div className="kicker">Something went wrong</div>
        <h1 className="h1">That didn&apos;t save.</h1>
      </div>
      <p className="sub">{error.message || "An unexpected error occurred."}</p>
      <p className="sub">
        Nothing was written. Go back and your other edits should still be in the form — if the
        same thing happens again, the message above is the reason.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
        <Link className="btnGhost" href="/">
          Back to Today
        </Link>
      </div>
      {error.digest && <p className="sub">Reference: {error.digest}</p>}
    </div>
  );
}
