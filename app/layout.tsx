import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { NavTabs } from "@/components/NavTabs";
import { prisma } from "@/lib/prisma";
import "./globals.css";
import styles from "./layout.module.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal Operating System",
  description: "Roles, outcomes, RAID, people, renewal — one system.",
};

export const dynamic = "force-dynamic";

async function missionLine(): Promise<string> {
  try {
    const profile = await prisma.profile.findUnique({ where: { id: 1 } });
    return profile?.mission ?? "";
  } catch {
    return ""; // build-time / DB-down fallback; pages surface real errors
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const mission = await missionLine();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className={styles.header}>
          <Link href="/settings" className={styles.missionBar}>
            <span className="kicker">Personal OS</span>
            {mission && <span className={styles.mission}>{mission}</span>}
          </Link>
          <NavTabs />
        </header>
        <main className={styles.main}>{children}</main>
      </body>
    </html>
  );
}
