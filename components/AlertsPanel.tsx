import type { Alert } from "@/lib/alerts";
import styles from "./AlertsPanel.module.css";

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return <div className={`sub ${styles.clear}`}>All clear — nothing needs attention.</div>;
  }
  return (
    <div className={styles.list}>
      {alerts.map((a) => (
        <div key={a.id} className={styles.alert} data-severity={a.severity}>
          <span className={styles.dot} />
          <span className={styles.message}>{a.message}</span>
        </div>
      ))}
    </div>
  );
}
