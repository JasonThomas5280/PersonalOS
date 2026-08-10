"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavTabs.module.css";

const TABS = [
  { href: "/", label: "Today" },
  { href: "/capture", label: "Capture" },
  { href: "/roles", label: "Roles" },
  { href: "/outcomes", label: "Outcomes" },
  { href: "/raid", label: "RAID" },
  { href: "/people", label: "People" },
  { href: "/sharpen", label: "Sharpen" },
  { href: "/review", label: "Review" },
  { href: "/settings", label: "Settings" },
] as const;

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      {TABS.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={active ? styles.active : styles.tab}
            // Gold text alone doesn't tell a screen reader which tab is current.
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
