"use client";

import { useEffect, useRef } from "react";

/**
 * Status select that makes the resolution field required when the item is being
 * closed.
 *
 * updateRaidItem throws "Closing a RAID item requires a resolution note." — a
 * real server-side guarantee, but with no client-side counterpart the user got
 * a full-page error and lost the rest of their edits. The rule is conditional,
 * so a static `required` attribute can't express it.
 *
 * Toggling the attribute on the sibling field hands the rule to native
 * constraint validation: the browser blocks the submit, focuses the field and
 * explains, and the form's other edits survive. The server throw stays as the
 * backstop for anything that bypasses this.
 */
export function RaidStatusSelect({
  defaultValue,
  statuses,
  id,
}: {
  defaultValue: string;
  statuses: readonly string[];
  id: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  function sync(value: string) {
    const field = ref.current?.form?.elements.namedItem("resolution");
    if (field instanceof HTMLTextAreaElement) {
      field.required = value === "CLOSED";
      field.setAttribute("aria-required", String(value === "CLOSED"));
    }
  }

  // An item already closed should arrive with the field marked required.
  useEffect(() => {
    sync(ref.current?.value ?? defaultValue);
  }, [defaultValue]);

  return (
    <select
      ref={ref}
      id={id}
      name="status"
      defaultValue={defaultValue}
      onChange={(e) => sync(e.currentTarget.value)}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {s.toLowerCase().replace("_", " ")}
        </option>
      ))}
    </select>
  );
}
