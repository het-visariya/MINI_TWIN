/**
 * Insights calculations. Pure: no Prisma, no React, no clock.
 *
 * This is the file most able to mislead, so it is the most conservative.
 *
 *  - The Life Graph stays locked below 21 days of data, and even then every
 *    correlation it reports is labelled "pattern, not proof". A correlation
 *    computed over a fortnight of a student's life is noise with a decimal
 *    point on it.
 *  - A pair with no variance in either series is omitted rather than reported
 *    as a correlation of zero: "your sleep does not affect your study time" is
 *    a much stronger claim than "you slept the same amount every day".
 *  - The weekly review is rule-based and quotes the user's own numbers back at
 *    them. Nothing in it is generated prose.
 */

export type PulseKey =
  | "academic"
  | "fitness"
  | "productivity"
  | "career"
  | "routine"
  | "momentum";

export const PULSE_KEYS: PulseKey[] = [
  "academic",
  "fitness",
  "productivity",
  "career",
  "routine",
  "momentum",
];

export const PULSE_LABELS: Record<PulseKey, string> = {
  academic: "Academic",
  fitness: "Fitness",
  productivity: "Productivity",
  career: "Career",
  routine: "Routine",
  momentum: "Momentum",
};

export type SnapshotRow = {
  /** ISO date, one row per day. */
  date: string;
  academic: number;
  fitness: number;
  productivity: number;
  career: number;
  routine: number;
  momentum: number;
};

/* -------------------------------------------------------------------------- */
/*                               twin evolution                               */
/* -------------------------------------------------------------------------- */

export type EvolutionSeries = {
  key: PulseKey;
  label: string;
  /** Oldest to newest, one entry per day present in the window. */
  points: { date: string; value: number }[];
  latest: number | null;
  /** Change against the first point in the window, in points. */
  change: number | null;
};

/**
 * One sparkline per score over the last `days` days.
 *
 * Gaps are left as gaps: a day with no snapshot is simply absent from
 * `points`, rather than being carried forward from yesterday. Interpolating
 * would draw a line through days the user did not actually log.
 */
export function twinEvolution(
  snapshots: SnapshotRow[],
  days = 30,
  now: Date = new Date(),
): EvolutionSeries[] {
  const cutoff = startOfDay(now).getTime() - (days - 1) * 86_400_000;

  const inWindow = snapshots
    .filter((row) => {
      const at = startOfDay(new Date(row.date)).getTime();
      return !Number.isNaN(at) && at >= cutoff;
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return PULSE_KEYS.map((key) => {
    const points = inWindow
      .map((row) => ({ date: isoDate(new Date(row.date)), value: num(row[key]) }))
      .filter((point) => Number.isFinite(point.value));

    const first = points[0]?.value ?? null;
    const latest = points[points.length - 1]?.value ?? null;

    return {
      key,
      label: PULSE_LABELS[key],
      points,
      latest,
      change: first === null || latest === null ? null : round(latest - first, 1),
    };
  });
}

/* -------------------------------------------------------------------------- */
/*                                 life graph                                 */
/* -------------------------------------------------------------------------- */

export type DaySeries = {
  id: string;
  label: string;
  /** One value per day, aligned with the other series. Null means not logged. */
  values: (number | null)[];
};

export type CorrelationStrength = "weak" | "moderate" | "strong";

export type Correlation = {
  aId: string;
  aLabel: string;
  bId: string;
  bLabel: string;
  /** Pearson r, −1 to 1. */
  r: number;
  strength: CorrelationStrength;
  direction: "together" | "opposite";
  /** Days where both series had a value. The sample size, stated. */
  days: number;
  /** Plain sentence, deliberately hedged. */
  statement: string;
};

export type LifeGraph =
  | { locked: true; daysCollected: number; needed: number }
  | { locked: false; daysCollected: number; needed: number; correlations: Correlation[] };

/** The product refuses to draw conclusions from less than three weeks. */
export const LIFE_GRAPH_MIN_DAYS = 21;

/**
 * Correlations between every pair of series, or a locked result.
 *
 * `daysCollected` counts days where at least one series had a value, which is
 * what the "9 of 21 days collected" ring shows. A pair is only correlated over
 * the days where *both* had a value, and that count travels with the result so
 * the UI can show it.
 */
export function lifeGraph(
  series: DaySeries[],
  minDays = LIFE_GRAPH_MIN_DAYS,
): LifeGraph {
  const length = series.reduce((max, s) => Math.max(max, s.values.length), 0);

  let daysCollected = 0;
  for (let day = 0; day < length; day += 1) {
    if (series.some((s) => isNumber(s.values[day]))) daysCollected += 1;
  }

  if (daysCollected < minDays) {
    return { locked: true, daysCollected, needed: minDays };
  }

  const correlations: Correlation[] = [];

  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      const a = series[i];
      const b = series[j];

      const pairs: [number, number][] = [];
      for (let day = 0; day < length; day += 1) {
        const x = a.values[day];
        const y = b.values[day];
        if (isNumber(x) && isNumber(y)) pairs.push([x, y]);
      }

      /* Fewer paired days than the threshold means this particular pair has
         not been observed enough, even if the window as a whole has. */
      if (pairs.length < minDays) continue;

      const r = pearson(
        pairs.map(([x]) => x),
        pairs.map(([, y]) => y),
      );

      /* Null when either series never moved. Reporting r = 0 there would read
         as "no relationship" when the truth is "nothing to relate". */
      if (r === null) continue;

      const magnitude = Math.abs(r);
      /* Below 0.3 is not worth a sentence in a product that promises not to
         manufacture insight. */
      if (magnitude < 0.3) continue;

      const direction = r > 0 ? "together" : "opposite";
      const strength: CorrelationStrength =
        magnitude >= 0.7 ? "strong" : magnitude >= 0.5 ? "moderate" : "weak";

      correlations.push({
        aId: a.id,
        aLabel: a.label,
        bId: b.id,
        bLabel: b.label,
        r: round(r, 2),
        strength,
        direction,
        days: pairs.length,
        statement:
          direction === "together"
            ? `On days your ${lower(a.label)} was higher, your ${lower(b.label)} tended to be higher too.`
            : `On days your ${lower(a.label)} was higher, your ${lower(b.label)} tended to be lower.`,
      });
    }
  }

  correlations.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));

  return { locked: false, daysCollected, needed: minDays, correlations };
}

/**
 * Pearson correlation coefficient, or null when either series has no variance.
 *
 * The null is the important part: the textbook formula divides by the product
 * of the standard deviations, and a flat series makes that zero. Returning NaN
 * would put "NaN" on the screen; returning 0 would be a lie.
 */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;

  const meanX = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }

  if (varianceX <= 0 || varianceY <= 0) return null;

  const r = covariance / Math.sqrt(varianceX * varianceY);
  if (!Number.isFinite(r)) return null;

  /* Clamp: floating-point error can push a perfect correlation to 1.0000001,
     and an |r| above 1 is not a thing. */
  return Math.min(1, Math.max(-1, r));
}

/* -------------------------------------------------------------------------- */
/*                                weekly review                              */
/* -------------------------------------------------------------------------- */

export type WeeklyReviewInput = {
  /** Workout sessions kept and planned over the week. */
  workouts?: { kept: number; planned: number } | null;
  /** Tasks closed and tasks that fell past their due date. */
  tasks?: { completed: number; overdue: number } | null;
  /** Per-subject attendance at the end of the week. */
  attendance?: { subject: string; pct: number; required: number }[];
  /** Nights with a sleep entry, and the mean duration in minutes. */
  sleep?: { nights: number; averageMinutes: number } | null;
  /** Days with any meal logged. */
  nutrition?: { daysLogged: number } | null;
  /** Spend against budget, in paise. */
  money?: { spentMinor: number; budgetMinor: number } | null;
  /** Roadmap items ticked this week. */
  career?: { itemsDone: number } | null;
};

export type WeeklyReviewResult = {
  wentWell: string[];
  slipped: string[];
  nextFocus: string[];
};

/**
 * The week in three columns, derived by rules.
 *
 * Every line quotes a number the user can go and check. Nothing compares them
 * with anybody else, nothing mentions weight or body shape, and the "next
 * focus" column suggests at most three things — a list of nine is a list the
 * user ignores.
 */
export function weeklyReview(input: WeeklyReviewInput): WeeklyReviewResult {
  const wentWell: string[] = [];
  const slipped: string[] = [];
  const nextFocus: string[] = [];

  const { workouts, tasks, attendance, sleep, nutrition, money, career } = input;

  if (workouts && workouts.planned > 0) {
    const line = `Workouts: ${workouts.kept} of ${workouts.planned} planned`;
    if (workouts.kept >= workouts.planned) wentWell.push(line);
    else if (workouts.kept === 0) {
      slipped.push(`${line} — none logged this week`);
      nextFocus.push("Put one workout in the calendar rather than deciding daily");
    } else {
      slipped.push(line);
    }
  }

  if (tasks) {
    if (tasks.completed > 0) {
      wentWell.push(
        `${tasks.completed} task${tasks.completed === 1 ? "" : "s"} finished`,
      );
    }
    if (tasks.overdue > 0) {
      slipped.push(
        `${tasks.overdue} task${tasks.overdue === 1 ? "" : "s"} went past their deadline`,
      );
      nextFocus.push("Re-estimate the overdue tasks before adding anything new");
    }
  }

  for (const subject of attendance ?? []) {
    if (subject.pct >= subject.required) {
      wentWell.push(
        `${subject.subject} attendance at ${Math.round(subject.pct)}%, above the ${subject.required}% rule`,
      );
    } else {
      slipped.push(
        `${subject.subject} attendance dropped to ${Math.round(subject.pct)}%, below the ${subject.required}% rule`,
      );
      nextFocus.push(`Attend every ${subject.subject} class next week`);
    }
  }

  if (sleep && sleep.nights > 0) {
    const hours = Math.floor(sleep.averageMinutes / 60);
    const minutes = Math.round(sleep.averageMinutes % 60);
    const text = `${hours}h ${minutes}m average sleep across ${sleep.nights} night${
      sleep.nights === 1 ? "" : "s"
    }`;

    if (sleep.averageMinutes >= 7 * 60) wentWell.push(text);
    else slipped.push(text);
  }

  if (nutrition && nutrition.daysLogged >= 5) {
    wentWell.push(`Meals logged on ${nutrition.daysLogged} days`);
  }

  if (money && money.budgetMinor > 0) {
    if (money.spentMinor <= money.budgetMinor) {
      wentWell.push("Stayed inside the month's budget so far");
    } else {
      slipped.push("Spending went past the month's budget");
      nextFocus.push("Look at the biggest category before the month ends");
    }
  }

  if (career && career.itemsDone > 0) {
    wentWell.push(
      `${career.itemsDone} roadmap item${career.itemsDone === 1 ? "" : "s"} ticked off`,
    );
  }

  return { wentWell, slipped, nextFocus: nextFocus.slice(0, 3) };
}

/* -------------------------------------------------------------------------- */
/*                                achievements                                */
/* -------------------------------------------------------------------------- */

export type AchievementKey =
  | "first-week-logged"
  | "four-week-workout-consistency"
  | "attendance-recovered"
  | "savings-goal-reached"
  | "first-weekly-review"
  | "thirty-days-of-data";

export type AchievementDefinition = {
  key: AchievementKey;
  label: string;
  /** What earns it, stated before it is earned so it is never a surprise. */
  requirement: string;
};

/**
 * The full list, including locked ones.
 *
 * Milestones only. No streaks that reset to zero, nothing that fires daily,
 * and nothing phrased as pressure — a locked achievement reads as information,
 * not as a debt.
 */
export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    key: "first-week-logged",
    label: "First full week",
    requirement: "Log something every day for seven days in a row",
  },
  {
    key: "four-week-workout-consistency",
    label: "Four weeks consistent",
    requirement: "Hit your own planned workout count four weeks running",
  },
  {
    key: "attendance-recovered",
    label: "Attendance recovered",
    requirement: "Bring a subject back above its attendance rule",
  },
  {
    key: "savings-goal-reached",
    label: "Savings goal reached",
    requirement: "Reach the target on any savings goal",
  },
  {
    key: "first-weekly-review",
    label: "First review read",
    requirement: "Read one weekly twin review",
  },
  {
    key: "thirty-days-of-data",
    label: "A month of history",
    requirement: "Collect thirty days of snapshots, which unlocks the Life Graph",
  },
];

export type AchievementInput = {
  consecutiveLoggedDays: number;
  consistentWorkoutWeeks: number;
  /** True once a subject that was below its rule is above it again. */
  attendanceRecovered: boolean;
  savingsGoalReached: boolean;
  weeklyReviewsRead: number;
  snapshotDays: number;
};

/** Which achievements the user's data currently satisfies. */
export function evaluateAchievements(input: AchievementInput): AchievementKey[] {
  const unlocked: AchievementKey[] = [];

  if (input.consecutiveLoggedDays >= 7) unlocked.push("first-week-logged");
  if (input.consistentWorkoutWeeks >= 4) unlocked.push("four-week-workout-consistency");
  if (input.attendanceRecovered) unlocked.push("attendance-recovered");
  if (input.savingsGoalReached) unlocked.push("savings-goal-reached");
  if (input.weeklyReviewsRead >= 1) unlocked.push("first-weekly-review");
  if (input.snapshotDays >= 30) unlocked.push("thirty-days-of-data");

  return unlocked;
}

/* -------------------------------------------------------------------------- */
/*                                   shared                                   */
/* -------------------------------------------------------------------------- */

/** Monday-start week containing `date`, matching the rest of the product. */
export function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const weekday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - weekday);
  return copy;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function num(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export function round(value: number, places = 0): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
