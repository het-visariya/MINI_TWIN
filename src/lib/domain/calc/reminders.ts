/**
 * Reminder scheduling and wording. Pure: no Prisma, no React, no clock.
 *
 * The notable thing in this file is what the copy does *not* contain. A
 * reminder is read on a lock screen, in a lecture, over someone's shoulder, so
 * `neutralCopy` never names a weight, an amount of money, a food or a medical
 * fact. It says "your evening check-in is open", not "you are 400 kcal under
 * target". The product's guardrails — quiet hours and a daily cap of three —
 * are enforced here rather than being left to the caller to remember.
 */

export type ReminderKind =
  | "DEADLINE"
  | "ATTENDANCE"
  | "WORKOUT"
  | "WATER"
  | "WEEKLY_REVIEW"
  | "CUSTOM";

export type ReminderChannel = "IN_APP" | "EMAIL" | "BOTH";

export type Prefs = {
  /** Hours 0–23. The range may cross midnight. */
  quietHoursStart: number;
  quietHoursEnd: number;
  dailyCap: number;
  emailEnabled: boolean;
  timezone: string;
};

export type RuleRow = {
  id: string;
  kind: ReminderKind;
  enabled: boolean;
  leadMinutes: number;
  channel: ReminderChannel;
  label?: string | null;
};

/** Anything a reminder can be about: a deadline, a class, a planned workout. */
export type DueCandidate = {
  id: string;
  kind: ReminderKind;
  title: string;
  /** When the thing itself happens. ISO string. */
  at: string;
};

/* -------------------------------------------------------------------------- */
/*                                 guardrails                                 */
/* -------------------------------------------------------------------------- */

/**
 * Is `now` inside quiet hours?
 *
 * Handles the range crossing midnight, which is the normal case: 22:00 to
 * 07:00 is nine hours spanning two dates, not a negative two-hour window. A
 * start equal to the end means quiet hours are off, not that the whole day is
 * quiet — the latter would silence the product permanently by accident.
 */
export function isInQuietHours(now: Date, prefs: Pick<Prefs, "quietHoursStart" | "quietHoursEnd">): boolean {
  const start = clampHour(prefs.quietHoursStart);
  const end = clampHour(prefs.quietHoursEnd);

  if (start === end) return false;

  const hour = now.getHours();

  if (start < end) return hour >= start && hour < end;

  /* Crosses midnight: quiet from `start` to the end of the day, and from
     midnight to `end`. */
  return hour >= start || hour < end;
}

/**
 * Has the daily cap been reached?
 *
 * Defaults to the documented cap of three if the stored value is nonsense, and
 * a cap of zero genuinely means "send nothing" — a user who turns reminders
 * all the way down is making a choice we honour.
 */
export function canSend(countToday: number, prefs: Pick<Prefs, "dailyCap">): boolean {
  const cap = Number.isFinite(prefs.dailyCap) ? Math.max(0, Math.floor(prefs.dailyCap)) : 3;
  const sent = Number.isFinite(countToday) ? Math.max(0, Math.floor(countToday)) : 0;
  return sent < cap;
}

/**
 * The single gate every send passes through.
 *
 * Returns a reason when it refuses, so the dev outbox and the test reminder
 * button can explain themselves instead of silently doing nothing.
 */
export function sendDecision(
  now: Date,
  prefs: Prefs,
  countToday: number,
): { send: true } | { send: false; reason: string } {
  if (isInQuietHours(now, prefs)) {
    return { send: false, reason: "inside quiet hours" };
  }
  if (!canSend(countToday, prefs)) {
    return { send: false, reason: `daily cap of ${prefs.dailyCap} already reached` };
  }
  return { send: true };
}

function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(23, Math.max(0, Math.floor(value)));
}

/* -------------------------------------------------------------------------- */
/*                                  due list                                  */
/* -------------------------------------------------------------------------- */

export type DueReminder = {
  ruleId: string;
  kind: ReminderKind;
  candidateId: string;
  channel: ReminderChannel;
  /** When this should go out: the thing's time minus the rule's lead. */
  sendAt: string;
  title: string;
  body: string;
};

/**
 * Which reminders are due at `now`.
 *
 * A reminder is due once its send time has passed and the thing it is about
 * has not: a nudge about a deadline that went by yesterday is not a reminder,
 * it is a reprimand. Disabled rules are skipped, and candidates with no
 * matching rule produce nothing — a rule is the user's opt-in.
 */
export function dueReminders(
  rules: RuleRow[],
  candidates: DueCandidate[],
  now: Date,
): DueReminder[] {
  const byKind = new Map<ReminderKind, RuleRow>();
  for (const rule of rules) {
    if (rule.enabled) byKind.set(rule.kind, rule);
  }

  const due: DueReminder[] = [];
  const at = now.getTime();

  for (const candidate of candidates) {
    const rule = byKind.get(candidate.kind);
    if (!rule) continue;

    const happensAt = new Date(candidate.at).getTime();
    if (Number.isNaN(happensAt)) continue;

    const lead = Number.isFinite(rule.leadMinutes) ? Math.max(0, rule.leadMinutes) : 0;
    const sendAt = happensAt - lead * 60_000;

    if (at < sendAt) continue;
    if (at > happensAt) continue;

    const copy = neutralCopy(candidate.kind);

    due.push({
      ruleId: rule.id,
      kind: candidate.kind,
      candidateId: candidate.id,
      channel: rule.channel,
      sendAt: new Date(sendAt).toISOString(),
      title: copy.title,
      body: copy.body,
    });
  }

  /* Soonest first, so when the cap bites it keeps the most urgent ones. */
  return due.sort((a, b) => (a.sendAt < b.sendAt ? -1 : 1));
}

/* -------------------------------------------------------------------------- */
/*                                  wording                                   */
/* -------------------------------------------------------------------------- */

/**
 * The only approved reminder wording.
 *
 * Every string here is deliberately free of numbers, amounts, food, body or
 * medical words. A notification is visible to whoever is looking at the phone,
 * and the product's promise is that it never discloses health or money details
 * — so the copy cannot contain them to begin with, rather than relying on a
 * caller to sanitise it. The details live behind the link, inside the app,
 * where the user has already authenticated.
 *
 * `neutralCopyIsSafe` below is the machine-checkable version of that promise.
 */
export function neutralCopy(kind: ReminderKind): { title: string; body: string } {
  switch (kind) {
    case "DEADLINE":
      return {
        title: "A deadline is coming up",
        body: "Open your twin to see what is due and what it needs from today.",
      };
    case "ATTENDANCE":
      return {
        title: "Attendance worth a look",
        body: "One of your subjects needs attention. The details are in Academic.",
      };
    case "WORKOUT":
      return {
        title: "Session planned for today",
        body: "You set aside time for this one. Open your twin when you are ready.",
      };
    case "WATER":
      return {
        title: "Quick check-in",
        body: "A short entry is waiting in your twin, if now suits.",
      };
    case "WEEKLY_REVIEW":
      return {
        title: "Your week is ready to read",
        body: "A short review of your own week is waiting in Insights.",
      };
    case "CUSTOM":
    default:
      return {
        title: "A reminder you set",
        body: "Open your twin to see what this was for.",
      };
  }
}

/**
 * Words a reminder must never contain, and the check that proves it.
 *
 * Kept next to the copy so that adding a new reminder kind with a leaky
 * string fails a test rather than reaching a lock screen. Digits are banned
 * outright: there is no reminder this product sends where a number in the
 * title is worth the disclosure.
 */
export const FORBIDDEN_IN_COPY = [
  "kg",
  "weight",
  "bmi",
  "calorie",
  "kcal",
  "protein",
  "fat",
  "carb",
  "diet",
  "meal",
  "ate",
  "food",
  "₹",
  "rs",
  "rupee",
  "spent",
  "budget",
  "salary",
  "money",
  "expense",
  "savings",
  "debt",
  "medical",
  "doctor",
  "mood",
  "sleep",
] as const;

export function neutralCopyIsSafe(copy: { title: string; body: string }): boolean {
  const text = `${copy.title} ${copy.body}`.toLowerCase();

  if (/\d/.test(text)) return false;

  return !FORBIDDEN_IN_COPY.some((word) =>
    new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(text),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* -------------------------------------------------------------------------- */
/*                               defaults & label                             */
/* -------------------------------------------------------------------------- */

export const REMINDER_KINDS: ReminderKind[] = [
  "DEADLINE",
  "ATTENDANCE",
  "WORKOUT",
  "WATER",
  "WEEKLY_REVIEW",
  "CUSTOM",
];

export const REMINDER_LABELS: Record<ReminderKind, string> = {
  DEADLINE: "Deadlines",
  ATTENDANCE: "Attendance",
  WORKOUT: "Planned workouts",
  WATER: "Check-ins",
  WEEKLY_REVIEW: "Weekly review",
  CUSTOM: "Custom",
};

/**
 * What a new account starts with.
 *
 * Deadlines and the weekly review only. Everything else is off until the user
 * asks for it: a product that switches on six kinds of notification by default
 * is the thing this one is reacting against.
 */
export const DEFAULT_RULES: {
  kind: ReminderKind;
  enabled: boolean;
  leadMinutes: number;
  channel: ReminderChannel;
}[] = [
  { kind: "DEADLINE", enabled: true, leadMinutes: 24 * 60, channel: "IN_APP" },
  { kind: "WEEKLY_REVIEW", enabled: true, leadMinutes: 0, channel: "IN_APP" },
  { kind: "ATTENDANCE", enabled: false, leadMinutes: 12 * 60, channel: "IN_APP" },
  { kind: "WORKOUT", enabled: false, leadMinutes: 60, channel: "IN_APP" },
  { kind: "WATER", enabled: false, leadMinutes: 0, channel: "IN_APP" },
];

/** Unread count for the header bell. */
export function unreadCount(notifications: { readAt: Date | string | null }[]): number {
  return notifications.filter((notification) => !notification.readAt).length;
}
