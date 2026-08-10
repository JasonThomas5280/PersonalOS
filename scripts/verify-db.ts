/**
 * Verify the database against seed/initial-state.json.
 *
 * Row counts for all 19 tables, each next to the count derived from the seed
 * file, plus three deep spot-checks. Expectations are DERIVED from the JSON
 * rather than hardcoded, so this keeps working when the seed file is replaced.
 *
 *   npm run verify
 *
 * Read-only. Safe to run against real data — a table simply reports "—" when
 * the seed file has nothing to say about it (i.e. the data came from the app,
 * not from a seed), and counts are still printed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { isoDate, daysUntil, todayUTC } from "../lib/dates";

// lib/prisma.ts does not load .env (Next.js does that for the app), so mirror
// the minimal loader seed/seed.ts uses before constructing a client.
for (const line of (() => {
  try {
    return readFileSync(resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
})()) {
  const m = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*"?([^"#]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const prisma = new PrismaClient();

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const OFF = "\x1b[0m";

let failures = 0;

/* ── expected counts, derived from the seed file ───────────── */

type Expected = Partial<Record<string, number>>;

function expectedCounts(): { expected: Expected; source: string } {
  let raw: string;
  const path = resolve(process.cwd(), "seed/initial-state.json");
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { expected: {}, source: "seed/initial-state.json not found — counts only" };
  }
  const j = JSON.parse(raw);
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const obj = (v: unknown): Record<string, never> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, never>) : {};

  const outcomes = arr(j.outcomes) as Record<string, unknown>[];
  const people = arr(j.people) as Record<string, unknown>[];
  const saw = obj(j.saw);
  const retros = arr(j.retros) as Record<string, unknown>[];

  // An outcome's role links are the union of its `roles` array and its primary
  // `role`, matching how seed.ts builds OutcomeRole.
  const outcomeRoles = outcomes.reduce((n, o) => {
    const set = new Set<string>(arr(o.roles).map(String));
    if (typeof o.role === "string" && o.role) set.add(o.role);
    return n + set.size;
  }, 0);

  // Seed skips Big 3 rows with no text (seed.ts:392).
  const bigThree = arr(j.bigThree).filter(
    (b) => typeof (b as Record<string, unknown>).text === "string" && (b as Record<string, unknown>).text,
  ).length;

  // Sessions are de-duplicated per practice on re-seed (seed.ts:451).
  const sawSessions = Object.values(saw).reduce(
    (n, p) => n + new Set(arr((p as Record<string, unknown>).history).map(String)).size,
    0,
  );

  return {
    source: `derived from seed/initial-state.json${j._note ? `  ${DIM}(${String(j._note).slice(0, 40)}…)${OFF}` : ""}`,
    expected: {
      Profile: 1,
      Role: arr(j.roles).length,
      Outcome: outcomes.length,
      OutcomeRole: outcomeRoles,
      OutcomeDependency: outcomes.reduce((n, o) => n + arr(o.dependsOn).length, 0),
      GateItem: outcomes.reduce((n, o) => n + arr(o.gate).length, 0),
      RaidItem: arr(j.raid).length,
      Person: people.length,
      PersonRole: people.reduce((n, p) => n + arr(p.roles).length, 0),
      PersonOutcome: people.reduce((n, p) => n + arr(p.outcomes).length, 0),
      Contribution: people.reduce((n, p) => n + arr(p.given).length, 0),
      Commitment: people.reduce((n, p) => n + arr(p.owed).length, 0),
      PotentialContribution: people.reduce((n, p) => n + arr(p.potential).length, 0),
      BigThreeItem: bigThree,
      SawPractice: Object.keys(saw).length,
      SawSession: sawSessions,
      WeeklyReview: Object.keys(obj(j.reviews)).length,
      Retro: retros.length,
      ProcessChange: retros.reduce((n, r) => n + arr(r.changes).length, 0),
    },
  };
}

/* ── 1. row counts ─────────────────────────────────────────── */

async function rowCounts(expected: Expected) {
  // All 19 models. No @@map in the schema, so these are also the table names.
  const counts: [string, number][] = [
    ["Profile", await prisma.profile.count()],
    ["Role", await prisma.role.count()],
    ["Outcome", await prisma.outcome.count()],
    ["OutcomeRole", await prisma.outcomeRole.count()],
    ["OutcomeDependency", await prisma.outcomeDependency.count()],
    ["GateItem", await prisma.gateItem.count()],
    ["RaidItem", await prisma.raidItem.count()],
    ["Person", await prisma.person.count()],
    ["PersonRole", await prisma.personRole.count()],
    ["PersonOutcome", await prisma.personOutcome.count()],
    ["Contribution", await prisma.contribution.count()],
    ["Commitment", await prisma.commitment.count()],
    ["PotentialContribution", await prisma.potentialContribution.count()],
    ["BigThreeItem", await prisma.bigThreeItem.count()],
    ["SawPractice", await prisma.sawPractice.count()],
    ["SawSession", await prisma.sawSession.count()],
    ["WeeklyReview", await prisma.weeklyReview.count()],
    ["Retro", await prisma.retro.count()],
    ["ProcessChange", await prisma.processChange.count()],
  ];

  console.log(`\n${"TABLE".padEnd(23)}${"ROWS".padStart(6)}${"EXPECTED".padStart(11)}   STATUS`);
  console.log("─".repeat(56));
  for (const [name, n] of counts) {
    const want = expected[name];
    let status = `${DIM}—${OFF}`;
    if (want !== undefined) {
      if (n === want) status = `${GREEN}ok${OFF}`;
      else {
        status = `${RED}MISMATCH${OFF}`;
        failures++;
      }
    }
    console.log(
      `${name.padEnd(23)}${String(n).padStart(6)}${(want === undefined ? "—" : String(want)).padStart(11)}   ${status}`,
    );
  }
  const total = counts.reduce((a, [, n]) => a + n, 0);
  console.log("─".repeat(56));
  console.log(`${"TOTAL".padEnd(23)}${String(total).padStart(6)}\n`);
}

/* ── 2. spot-check: outcome with roles, gate, dependencies ─── */

async function spotCheckOutcome() {
  // Include shape lifted from app/outcomes/page.tsx:21-29 — the richest one,
  // and the only one that resolves the dependency to the blocking outcome.
  const all = await prisma.outcome.findMany({
    include: {
      primaryRole: true,
      roles: { include: { role: true } },
      gateItems: { orderBy: { sortOrder: "asc" } },
      blockedBy: { include: { blocking: true } },
    },
  });
  // Show whichever outcome exercises the most relations — an outcome with no
  // gate items and no dependencies proves nothing about those joins.
  const o = all.reduce<(typeof all)[number] | null>(
    (best, c) =>
      !best ||
      c.roles.length + c.gateItems.length + c.blockedBy.length >
        best.roles.length + best.gateItems.length + best.blockedBy.length
        ? c
        : best,
    null,
  );

  console.log("SPOT-CHECK 1 — outcome with roles, gate items, dependencies");
  console.log("─".repeat(56));
  if (!o) {
    console.log(`${DIM}no outcomes${OFF}\n`);
    return;
  }
  console.log(`  result        ${o.result}`);
  console.log(`  purpose       ${o.purpose ? o.purpose.slice(0, 60) : `${DIM}(none)${OFF}`}`);
  console.log(`  phase         ${o.phase}${o.criticalPath ? "   [critical path]" : ""}`);
  console.log(`  primary role  ${o.primaryRole ? `${o.primaryRole.icon} ${o.primaryRole.label}` : `${DIM}(none)${OFF}`}`);
  console.log(
    `  roles (${o.roles.length})     ${o.roles.map((r) => r.role.label).join(", ") || `${DIM}(none)${OFF}`}`,
  );
  console.log(
    `  baseline      ${o.baselineDate ? isoDate(o.baselineDate) : `${DIM}(unset)${OFF}`}   target ${o.targetDate ? isoDate(o.targetDate) : `${DIM}(unset)${OFF}`}   weekly ${o.weeklyHours ?? "—"}h`,
  );
  console.log(`  gate items (${o.gateItems.length})`);
  for (const g of o.gateItems) console.log(`      [${g.met ? "x" : " "}] ${g.text}`);
  console.log(`  depends on (${o.blockedBy.length})`);
  for (const d of o.blockedBy) console.log(`      → ${d.blocking.result}  ${DIM}(${d.blocking.phase})${OFF}`);

  // If the richest outcome has no dependencies, the OutcomeDependency join is
  // still unproven — show every edge in the graph so it isn't silently skipped.
  if (o.blockedBy.length === 0) {
    const edges = all.flatMap((x) =>
      x.blockedBy.map((d) => `      ${x.result}  ←  ${d.blocking.result}`),
    );
    console.log(
      edges.length
        ? `  ${DIM}dependency edges elsewhere (${edges.length}):${OFF}\n${edges.join("\n")}`
        : `  ${DIM}no dependency edges anywhere${OFF}`,
    );
  }

  // A dependency row that doesn't resolve means the join is broken.
  const dangling = o.blockedBy.filter((d) => !d.blocking).length;
  if (dangling) {
    console.log(`  ${RED}${dangling} dependency row(s) did not resolve${OFF}`);
    failures++;
  }
  console.log();
}

/* ── 3. spot-check: person with ledger + ring ──────────────── */

async function spotCheckPerson() {
  // Include shape from app/api/export/route.ts:19-21 (resolves role slugs).
  const p =
    (await prisma.person.findFirst({
      where: { given: { some: {} } },
      include: {
        roles: { include: { role: true } },
        outcomes: true,
        given: { orderBy: { date: "desc" } },
        owed: { orderBy: [{ done: "asc" }, { due: "asc" }] },
        potential: true,
      },
    })) ??
    (await prisma.person.findFirst({
      include: {
        roles: { include: { role: true } },
        outcomes: true,
        given: true,
        owed: true,
        potential: true,
      },
    }));

  console.log("SPOT-CHECK 2 — person with contributions, commitments, ring");
  console.log("─".repeat(56));
  if (!p) {
    console.log(`${DIM}no people${OFF}\n`);
    return;
  }
  const now = todayUTC();
  console.log(`  name          ${p.name}${p.title ? `, ${p.title}` : ""}${p.employer ? ` (${p.employer})` : ""}`);
  console.log(`  ring          ${p.ring}   stage ${p.stage}   cadence ${p.cadenceDays ?? "—"}d`);
  console.log(`  node type     ${p.nodeType ?? `${DIM}(none)${OFF}`}`);
  console.log(
    `  engines       primary ${p.primaryEngine ?? "—"} / secondary ${p.secondaryEngine ?? "—"} / rejected ${p.rejectedEngine ?? "—"}  ${DIM}confidence ${p.engineConfidence ?? "—"}${OFF}`,
  );
  console.log(`  last contact  ${p.lastContact ? isoDate(p.lastContact) : `${DIM}(never)${OFF}`}`);
  console.log(`  roles         ${p.roles.map((r) => r.role.label).join(", ") || `${DIM}(none)${OFF}`}`);
  console.log(`  ledger — contributions given (${p.given.length})`);
  for (const c of p.given) console.log(`      ${isoDate(c.date)}  ${c.category.padEnd(14)} ${c.text}`);
  console.log(`  ledger — commitments owed (${p.owed.length})`);
  for (const c of p.owed) {
    const overdue = !c.done && c.due && daysUntil(c.due, now) < 0;
    const tag = c.done ? "done" : overdue ? `${RED}OVERDUE — broken commitment${OFF}` : "open";
    console.log(`      ${c.due ? isoDate(c.due) : "no due date"}  ${c.text}  [${tag}]`);
  }
  console.log(`  ledger — potential contributions (${p.potential.length})`);
  for (const c of p.potential) console.log(`      ${c.text}`);
  console.log();
}

/* ── 4. spot-check: saw practices with session counts ──────── */

async function spotCheckSaw() {
  const practices = await prisma.sawPractice.findMany({
    orderBy: { dimension: "asc" },
    include: { role: true, _count: { select: { sessions: true } } },
  });

  console.log("SPOT-CHECK 3 — saw practices with session counts");
  console.log("─".repeat(56));
  if (!practices.length) {
    console.log(`${DIM}no practices${OFF}\n`);
    return;
  }
  for (const p of practices) {
    console.log(
      `  ${p.dimension.padEnd(10)} ${String(p._count.sessions).padStart(3)} sessions   ${p.cadence ?? "no cadence"}   ${p.sessionMinutes ?? "—"}min`,
    );
    console.log(`      practice  ${p.practice || `${DIM}(unset)${OFF}`}`);
    console.log(
      `      floor     ${p.minimumViable || `${DIM}(unset)${OFF}`}${p.mvMinutes ? ` (${p.mvMinutes}min)` : ""}`,
    );
    if (p.role) console.log(`      role      ${p.role.label}`);
  }
  const total = practices.reduce((a, p) => a + p._count.sessions, 0);
  console.log(`  ${DIM}${practices.length} practices, ${total} sessions total${OFF}\n`);
}

/* ── 5. round-trip parity ──────────────────────────────────── */

/**
 * Fields the export deliberately omits, so a naive diff doesn't flag them:
 * timestamps, surrogate cuids for child rows (order carries the meaning),
 * Role.id (the slug is the exported key) and sortOrder (implied by array
 * position, restored from the index by seed.ts), plus roleHealth/roleNotes
 * entries with falsy values (absence means null, not loss).
 */
const IGNORED_LEAF = /(^|\.)(createdAt|updatedAt|_note)$/;

function diff(a: unknown, b: unknown, path = ""): string[] {
  if (IGNORED_LEAF.test(path)) return [];
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  const kind = (v: unknown) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);
  const ka = kind(a);
  const kb = kind(b);
  if (ka !== kb) {
    // "", null and absent all mean "unset" and round-trip to the same column
    // value — the seed file and the export disagree on which one they write.
    const unset = (v: unknown) => v === "" || v === null || v === undefined;
    if (unset(a) && unset(b)) return [];
    return [`${path}: ${ka} vs ${kb}   ${JSON.stringify(a)} | ${JSON.stringify(b)}`];
  }
  if (ka === "array") {
    const A = a as unknown[];
    const B = b as unknown[];
    const out: string[] = [];
    if (A.length !== B.length) out.push(`${path}: ${A.length} items vs ${B.length}`);
    for (let i = 0; i < Math.max(A.length, B.length); i++) out.push(...diff(A[i], B[i], `${path}[${i}]`));
    return out;
  }
  if (ka === "object") {
    const A = a as Record<string, unknown>;
    const B = b as Record<string, unknown>;
    return [...new Set([...Object.keys(A), ...Object.keys(B)])]
      .sort()
      .flatMap((k) => diff(A[k], B[k], path ? `${path}.${k}` : k));
  }
  return [`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`];
}

async function roundTrip(countsMatched: boolean) {
  console.log("ROUND-TRIP PARITY — GET /api/export vs seed/initial-state.json");
  console.log("─".repeat(56));
  if (!countsMatched) {
    console.log(`${DIM}skipped — row counts already differ from the seed file, so the${OFF}`);
    console.log(`${DIM}database is not expected to be a copy of it.${OFF}\n`);
    return;
  }
  let seed: Record<string, unknown>;
  try {
    seed = JSON.parse(readFileSync(resolve(process.cwd(), "seed/initial-state.json"), "utf8"));
  } catch {
    console.log(`${DIM}skipped — seed file not readable${OFF}\n`);
    return;
  }
  // The route handler is a plain function returning a Response; no server needed.
  const { GET } = await import("../app/api/export/route");
  const exported = (await (await GET()).json()) as Record<string, unknown>;

  // exportedAt is stamped at export time and is not part of the data.
  delete seed.exportedAt;
  delete exported.exportedAt;

  const differences = diff(seed, exported);
  if (differences.length === 0) {
    console.log(`${GREEN}exact match${OFF} — every field survives the round trip\n`);
    return;
  }
  console.log(`${RED}${differences.length} difference(s):${OFF}`);
  for (const d of differences.slice(0, 40)) console.log(`  ${d}`);
  if (differences.length > 40) console.log(`  ${DIM}…and ${differences.length - 40} more${OFF}`);
  console.log();
  failures++;
}

/* ── main ──────────────────────────────────────────────────── */

/**
 * Is this database a copy of the seed file, or real data entered through the
 * app? Comparing real data against seed-derived expectations produces nothing
 * but noise, so the seed file's role slugs are the tell — the seed writes them
 * verbatim, and any other set means the data came from somewhere else.
 */
async function isSeedDerived(): Promise<boolean> {
  let seedSlugs: string[];
  try {
    const j = JSON.parse(readFileSync(resolve(process.cwd(), "seed/initial-state.json"), "utf8"));
    if (!Array.isArray(j.roles) || j.roles.length === 0) return false;
    seedSlugs = j.roles.map((r: Record<string, unknown>) => String(r.slug ?? r.key ?? r.id)).sort();
  } catch {
    return false;
  }
  const dbSlugs = (await prisma.role.findMany({ select: { slug: true } })).map((r) => r.slug).sort();
  return dbSlugs.length === seedSlugs.length && dbSlugs.every((s, i) => s === seedSlugs[i]);
}

async function main() {
  console.log(`\nPersonalOS — database verification`);

  const seeded = await isSeedDerived();
  const { expected, source } = seeded ? expectedCounts() : { expected: {}, source: "" };
  console.log(
    seeded
      ? `${DIM}expected counts ${source}${OFF}`
      : `${DIM}real data — counts only. Expectations are checked against${OFF}\n` +
          `${DIM}seed/initial-state.json, and this database doesn't come from it.${OFF}`,
  );

  await rowCounts(expected);
  const countsMatched = seeded && failures === 0;
  await spotCheckOutcome();
  await spotCheckPerson();
  await spotCheckSaw();
  await roundTrip(countsMatched);

  if (failures) {
    console.log(`${RED}${failures} check(s) failed.${OFF}\n`);
    process.exitCode = 1;
  } else {
    console.log(`${GREEN}All checks passed.${OFF}\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
