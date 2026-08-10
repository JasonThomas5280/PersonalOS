import Link from "next/link";
import { alertHref, type Alert } from "@/lib/alerts";
import styles from "./AlertsPanel.module.css";

const SEVERITY_WORD = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
} as const;

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return <div className={`sub ${styles.clear}`}>All clear — nothing needs attention.</div>;
  }

  const counts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    /* polite: alerts are derived, so they change under the user after a save. */
    <div className={styles.list} role="status" aria-live="polite">
      <p className={styles.summary}>
        {(["critical", "warning", "info"] as const)
          .filter((s) => counts[s])
          .map((s) => `${counts[s]} ${SEVERITY_WORD[s].toLowerCase()}`)
          .join(" · ")}
      </p>

      {alerts.map((a) => {
        const href = alertHref(a);
        const body = (
          <>
            <span className={styles.dot} aria-hidden="true" />
            {/* Severity was carried by dot colour alone — a 1.4.1 failure. */}
            <span className={styles.severity}>{SEVERITY_WORD[a.severity]}</span>
            <span className={styles.message}>{a.message}</span>
            {href && (
              <span className={styles.go} aria-hidden="true">
                →
              </span>
            )}
          </>
        );

        // Only alerts that resolve to a record become links — the rest would be
        // fake buttons.
        return href ? (
          <Link key={a.id} href={href} className={styles.alert} data-severity={a.severity} data-link>
            {body}
          </Link>
        ) : (
          <div key={a.id} className={styles.alert} data-severity={a.severity}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
