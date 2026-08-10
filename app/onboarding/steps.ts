/**
 * The guided setup, as data.
 *
 * Each step is its own route (`/onboarding/<slug>`) and persists on submit, so
 * the flow survives a closed tab. `Profile.onboardedAt` is the completion
 * marker — emptiness stops being a usable signal once the roles step has run.
 *
 * Welcome, rhythm and done carry no data; the numbered steps are the ones the
 * progress indicator counts, mirroring the prototype's "Step N of 9".
 */
export type Step = {
  slug: string;
  title: string;
  /** False for the framing screens that write nothing. */
  data: boolean;
};

export const STEPS: Step[] = [
  { slug: "welcome", title: "Welcome", data: false },
  { slug: "mission", title: "Mission", data: true },
  { slug: "roles", title: "Roles", data: true },
  { slug: "depth", title: "Role depth", data: true },
  { slug: "capacity", title: "Capacity", data: true },
  { slug: "outcomes", title: "Outcomes", data: true },
  { slug: "renewal", title: "Renewal", data: true },
  { slug: "raid", title: "RAID", data: true },
  { slug: "people", title: "People", data: true },
  { slug: "rhythm", title: "Rhythm", data: false },
  { slug: "done", title: "Done", data: false },
];

export const DATA_STEP_COUNT = STEPS.filter((s) => s.data).length;

export function stepIndex(slug: string): number {
  return STEPS.findIndex((s) => s.slug === slug);
}

/** 1-based position among the data steps, or null for framing screens. */
export function dataStepNumber(slug: string): number | null {
  const i = stepIndex(slug);
  if (i < 0 || !STEPS[i].data) return null;
  return STEPS.slice(0, i + 1).filter((s) => s.data).length;
}

export function nextSlug(slug: string): string | null {
  const i = stepIndex(slug);
  return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1].slug : null;
}

export function prevSlug(slug: string): string | null {
  const i = stepIndex(slug);
  return i > 0 ? STEPS[i - 1].slug : null;
}

export function href(slug: string): string {
  return `/onboarding/${slug}`;
}

/* ── shared option sets ─────────────────────────────────────── */

/** The prototype's six defaults. Custom roles are added alongside these. */
export const DEFAULT_ROLES = [
  {
    slug: "faith",
    label: "Faith Leader",
    icon: "✝",
    hint: "Ministry, teaching, spiritual leadership of other people",
    prompt: "Who are you leading, and toward what?",
    example:
      "To lead people toward honesty about where they actually are, not where they're supposed to be.",
  },
  {
    slug: "husband",
    label: "Husband",
    icon: "♥",
    hint: "Your marriage as its own thing, separate from family logistics",
    prompt: "What kind of partner are you trying to be — not what tasks you do?",
    example: "To be someone she doesn't have to manage — present, honest, and easy to reach.",
  },
  {
    slug: "father",
    label: "Father",
    icon: "★",
    hint: "Your kids — presence, formation, showing up",
    prompt: "What do you want them to have gotten from you?",
    example: "To be the steady one. They should never have to guess what mood I'm in.",
  },
  {
    slug: "professional",
    label: "Professional",
    icon: "◆",
    hint: "The job — craft, reputation, the people you work with",
    prompt: "What's the standard you hold regardless of who's watching?",
    example:
      "To be the person who catches what falls between teams, and to build a reputation that outlasts any one employer.",
  },
  {
    slug: "builder",
    label: "Builder",
    icon: "⚡",
    hint: "Side ventures, projects, the things you're making",
    prompt: "What are you building toward, and why does it matter beyond the money?",
    example:
      "To build something that earns without renting all my hours, so my time belongs to my family again.",
  },
  {
    slug: "self",
    label: "Self",
    icon: "◉",
    hint: "Health, learning, the person you're becoming",
    prompt: "Who are you becoming, and what does that require of you?",
    example: "To stay someone my family can rely on physically and mentally for another thirty years.",
  },
];

export const ICONS = ["✝", "♥", "★", "◆", "⚡", "◉", "▲", "❋", "◈", "☗", "⬢", "✦", "♠", "☘", "⌘", "◐"];

export const SAW_DIMS = [
  {
    key: "PHYSICAL",
    label: "Physical",
    desc: "Sleep, movement, food",
    ex: "30 min walk before the day starts",
    mv: "Ten minutes outside, no phone",
    defMin: 30,
  },
  {
    key: "MENTAL",
    label: "Mental",
    desc: "Learning not in service of a deliverable",
    ex: "20 pages of something not work-related",
    mv: "Five pages before bed",
    defMin: 30,
  },
  {
    key: "SPIRITUAL",
    label: "Spiritual",
    desc: "What reconnects you to the why",
    ex: "Scripture and silence before the phone",
    mv: "One passage, two minutes",
    defMin: 20,
  },
  {
    key: "SOCIAL",
    label: "Social / Emotional",
    desc: "Relationships fed for their own sake",
    ex: "One unhurried conversation with no agenda",
    mv: "One real text to one real person",
    defMin: 45,
  },
];

/** Weekly sessions implied by each cadence — used for the renewal hours math. */
export const CADENCE_PER_WEEK: Record<string, number> = {
  DAILY: 7,
  FIVE_X_WEEK: 5,
  THREE_X_WEEK: 3,
  WEEKLY: 1,
};

export const CAPACITY_FIELDS = [
  { key: "sleep", label: "Sleep", hint: "8h × 7 = 56", def: 56 },
  { key: "work", label: "Work", hint: "Including the parts that spill over", def: 40 },
  { key: "commute", label: "Commute / getting ready", hint: "0 if fully remote", def: 0 },
  { key: "family", label: "Family and childcare", hint: "Actual hands-on time", def: 35 },
  {
    key: "household",
    label: "Household, errands, admin",
    hint: "Groceries, bills, repairs, the endless small stuff",
    def: 10,
  },
  {
    key: "existing",
    label: "Existing commitments",
    hint: "Church, volunteering, standing obligations",
    def: 5,
  },
];
