import { Dumbbell, Stethoscope, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  deleteWorkout,
  logSleep,
  logWater,
  logWeight,
  logWorkout,
  saveHealthProfile,
  saveMoodCheckin,
} from "@/app/(app)/health/actions";
import { BarChart, TrendChart } from "@/components/patterns/charts";
import { DeleteButton } from "@/components/patterns/delete-button";
import { ModuleTabs } from "@/components/patterns/module-tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState, GridSkeleton } from "@/components/patterns/states";
import { HealthProfileForm, SleepForm, WeightForm } from "@/components/health/body-forms";
import { MoodCheckin } from "@/components/health/mood-checkin";
import { WaterLog } from "@/components/health/water-log";
import { WorkoutLogger } from "@/components/health/workout-logger";
import { getHealthRepo } from "@/lib/data/repo";
import { isoDate } from "@/lib/domain/calc/health";
import type { HealthView } from "@/lib/data/health.repo";

export const metadata: Metadata = { title: "Health" };

export default function HealthPage() {
  return (
    <Suspense fallback={<GridSkeleton count={4} />}>
      <HealthContent />
    </Suspense>
  );
}

async function HealthContent() {
  const repo = await getHealthRepo();
  const now = new Date();
  const view = await repo.getHealth(now);
  const today = isoDate(now);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Health"
        description="Workouts, sleep, weight and a five-second check-in — tracked for awareness, with no targets you did not set."
        askAbout="my training and sleep"
      />

      {view.profile.hasMedicalCondition && <DoctorNote />}

      <ModuleTabs
        tabs={[
          { value: "workouts", label: "Workouts", content: <WorkoutsTab view={view} today={today} /> },
          { value: "body", label: "Body", content: <BodyTab view={view} today={today} /> },
          { value: "sleep", label: "Sleep", content: <SleepTab view={view} today={today} /> },
          {
            value: "water",
            label: "Water",
            content: (
              <WaterLog
                action={logWater}
                today={today}
                todayMl={view.water.todayMl}
                target={view.water.target}
              />
            ),
          },
          {
            value: "checkin",
            label: "Check-in",
            content: (
              <MoodCheckin action={saveMoodCheckin} today={today} existing={view.mood} />
            ),
          },
        ]}
      />

      <Disclaimer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   safety                                   */
/* -------------------------------------------------------------------------- */

/**
 * Shown on every Health view for anyone who recorded a condition during setup.
 * Persistent rather than dismissible: the point is that it is there when they
 * are reading a number, not that they acknowledged it once.
 */
function DoctorNote() {
  return (
    <div
      role="note"
      className="border-attention/35 bg-attention/10 flex items-start gap-3 rounded-xl border p-3.5"
    >
      <Stethoscope className="text-attention mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="text-xs leading-relaxed">
        <span className="font-medium">Talk to a doctor before acting on these numbers.</span>{" "}
        You told us about a medical condition during setup. Everything on this screen is a
        general estimate and none of it accounts for that.
      </p>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="text-muted-foreground border-t pt-4 text-xs">
      Not medical advice. Every estimate here is marked as one, and nothing on this screen
      is a diagnosis or a prescription.
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  workouts                                  */
/* -------------------------------------------------------------------------- */

function WorkoutsTab({ view, today }: { view: HealthView; today: string }) {
  const { sessions, personalRecords, volume, consistency } = view;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <WorkoutLogger
          action={logWorkout}
          today={today}
          exerciseHistory={view.exerciseHistory}
          personalRecords={personalRecords}
        />

        <section aria-labelledby="sessions-heading" className="space-y-3">
          <h2 id="sessions-heading" className="text-base font-medium">
            Recent sessions
          </h2>

          {sessions.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="No workouts logged yet"
              purpose="Log a session above and this fills in — weekly volume, personal records, and how consistent you have been against your own plan."
              action={
                <p className="text-muted-foreground text-xs">
                  Your first session takes about twenty seconds to enter.
                </p>
              }
            />
          ) : (
            <ul className="space-y-2">
              {sessions.slice(0, 12).map((session) => (
                <li
                  key={session.id}
                  className="bg-card shadow-card flex items-start gap-3 rounded-xl border p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {new Date(session.date).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {session.sets.length} set{session.sets.length === 1 ? "" : "s"} ·{" "}
                      <span className="tabular font-mono">
                        {Math.round(session.volumeKg).toLocaleString("en-IN")}
                      </span>{" "}
                      kg total volume
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {summariseSets(session.sets)}
                    </p>
                    {session.notes && (
                      <p className="mt-1.5 text-xs italic">{session.notes}</p>
                    )}
                  </div>

                  <DeleteButton
                    action={deleteWorkout}
                    name="sessionId"
                    id={session.id}
                    label={`the workout on ${new Date(session.date).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short" },
                    )}`}
                    description="The session and its sets are removed. Your personal records are recalculated from what is left."
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section
          aria-labelledby="volume-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="volume-heading" className="text-sm font-medium">
            Weekly volume
          </h2>
          <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
            Reps multiplied by weight, added up per week. Compared only with your own
            previous weeks.
          </p>
          <BarChart
            bars={volume.map((week, index) => ({
              label: weekLabel(week.weekStart),
              value: week.volumeKg,
              emphasis: index === volume.length - 1,
              display: `${Math.round(week.volumeKg).toLocaleString("en-IN")} kg`,
            }))}
            caption="Total volume per week, this week last."
          />
        </section>

        {consistency && (
          <section className="bg-card shadow-card rounded-xl border p-4">
            <h2 className="text-sm font-medium">This week</h2>
            <p className="mt-2 text-2xl font-medium">
              <span className="tabular font-mono">{consistency.kept}</span>
              <span className="text-muted-foreground text-base">
                {" "}
                of {consistency.planned} planned
              </span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Against the number you set yourself. Change it in Your basics on the Body tab.
            </p>
          </section>
        )}

        <section
          aria-labelledby="pr-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="pr-heading" className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="text-accent size-4" aria-hidden />
            Personal records
          </h2>

          {personalRecords.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Your best lifts appear here once you have logged a set with weight on it.
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-2.5">
                {personalRecords.map((record) => (
                  <li key={record.exercise} className="text-xs">
                    <p className="font-medium capitalize">{record.exercise}</p>
                    <p className="text-muted-foreground mt-0.5">
                      Best lift{" "}
                      <span className="tabular font-mono">{record.bestWeightKg}</span> kg ×{" "}
                      {record.bestWeightReps} · estimated one-rep max{" "}
                      <span className="tabular font-mono">
                        {record.estimatedOneRepMaxKg}
                      </span>{" "}
                      kg
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs">
                The one-rep max is an estimate from the Epley formula, not a lift you have
                done. Your best lift above is a measurement.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** "Squat 3×5 @ 70 kg · Bench press 3×8 @ 45 kg" */
function summariseSets(
  sets: { exercise: string; reps: number; weightKg: number }[],
): string {
  const grouped = new Map<string, { count: number; reps: number; weightKg: number }>();

  for (const set of sets) {
    const key = `${set.exercise}|${set.reps}|${set.weightKg}`;
    const current = grouped.get(key);
    if (current) current.count += 1;
    else grouped.set(key, { count: 1, reps: set.reps, weightKg: set.weightKg });
  }

  return [...grouped.entries()]
    .map(([key, value]) => {
      const exercise = key.split("|")[0];
      const load = value.weightKg > 0 ? ` @ ${value.weightKg} kg` : " bodyweight";
      return `${exercise} ${value.count}×${value.reps}${load}`;
    })
    .join(" · ");
}

function weekLabel(weekStart: string): string {
  return new Date(weekStart).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/* -------------------------------------------------------------------------- */
/*                                    body                                    */
/* -------------------------------------------------------------------------- */

function BodyTab({ view, today }: { view: HealthView; today: string }) {
  const { profile, weights, bmi, bmiVerdict, protein, calories } = view;

  return (
    <div className="space-y-6">
      <HealthProfileForm
        action={saveHealthProfile}
        heightCm={profile.heightCm}
        activityLevel={profile.activityLevel}
        plannedPerWeek={profile.plannedPerWeek}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section
          aria-labelledby="weight-heading"
          className="bg-card shadow-card rounded-xl border p-4"
        >
          <h2 id="weight-heading" className="text-base font-medium">
            Weight
          </h2>
          <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
            Your own trend. There is no target line here unless you set one.
          </p>

          <WeightForm action={logWeight} today={today} latestWeightKg={view.latestWeightKg} />

          {weights.length >= 2 ? (
            <div className="mt-4 border-t pt-4">
              <TrendChart
                series={[
                  {
                    label: "Your weight (kg)",
                    values: weights.map((row) => row.weightKg),
                    emphasis: true,
                  },
                ]}
                labels={weights.map((row) => row.date)}
              />
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 border-t pt-4 text-xs">
              Record two or more entries and a trend line appears here.
            </p>
          )}

          {!profile.mayShowWeightGoal && (
            <p className="text-muted-foreground mt-3 border-t pt-3 text-2xs">
              Weight goals are not part of this app under 20. The log is here so you can see
              your own trend, and that is all it is for.
            </p>
          )}
        </section>

        <div className="space-y-6">
          <section className="bg-card shadow-card rounded-xl border p-4">
            <h2 className="text-sm font-medium">BMI</h2>

            {bmi === null ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Add your height and one weight entry to see this.
              </p>
            ) : (
              <>
                <p className="tabular mt-2 font-mono text-2xl font-medium">{bmi}</p>
                <p className="mt-1 text-xs">
                  {bmiVerdict.kind === "unavailable" ? (
                    <span className="text-muted-foreground">
                      No category shown — {bmiVerdict.reason}.
                    </span>
                  ) : (
                    bmiVerdict.label
                  )}
                </p>
                <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs leading-relaxed">
                  {bmiVerdict.kind === "for-age"
                    ? "Under 20, BMI is read against the CDC 2000 BMI-for-age reference for your age and sex, because the adult bands do not apply while you are still growing."
                    : "BMI says nothing about muscle, build or health on its own. It is one crude number, included because it is asked for."}
                </p>
              </>
            )}
          </section>

          <section className="bg-card shadow-card rounded-xl border p-4">
            <h2 className="text-sm font-medium">Estimates</h2>

            <dl className="mt-3 space-y-3 text-xs">
              <div>
                <dt className="font-medium">Protein</dt>
                <dd className="text-muted-foreground mt-0.5">
                  {protein.range ? (
                    <>
                      <span className="tabular font-mono">
                        {protein.range.min}–{protein.range.max}
                      </span>{" "}
                      g a day
                      {protein.perMeal && (
                        <>
                          {" "}
                          · about{" "}
                          <span className="tabular font-mono">
                            {protein.perMeal.min}–{protein.perMeal.max}
                          </span>{" "}
                          g across {protein.perMeal.meals} meals
                        </>
                      )}
                    </>
                  ) : (
                    "Add a weight entry to see a range."
                  )}
                </dd>
              </div>

              <div>
                <dt className="font-medium">Energy</dt>
                <dd className="text-muted-foreground mt-0.5">
                  {calories ? (
                    <>
                      about{" "}
                      <span className="tabular font-mono">
                        {calories.kcal.toLocaleString("en-IN")}
                      </span>{" "}
                      kcal a day
                    </>
                  ) : view.profile.ageYears !== null && view.profile.ageYears < 18 ? (
                    "Not shown under 18."
                  ) : (
                    "Needs your height, weight and sex."
                  )}
                </dd>
              </div>
            </dl>

            <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs leading-relaxed">
              Both are population estimates, not measurements of you.
              {protein.range && ` Protein range from ${protein.range.source}.`}
              {calories && ` Energy from ${calories.source}.`}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   sleep                                    */
/* -------------------------------------------------------------------------- */

function SleepTab({ view, today }: { view: HealthView; today: string }) {
  const { sleep } = view;

  const average =
    sleep.length === 0
      ? null
      : Math.round(sleep.reduce((sum, row) => sum + row.minutes, 0) / sleep.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section
        aria-labelledby="sleep-heading"
        className="bg-card shadow-card rounded-xl border p-4"
      >
        <h2 id="sleep-heading" className="text-base font-medium">
          Sleep
        </h2>
        <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
          Enter when you went to bed and when you woke. The duration is worked out from
          those, including nights that cross midnight.
        </p>

        <SleepForm action={logSleep} today={today} />

        {sleep.length >= 2 ? (
          <div className="mt-4 border-t pt-4">
            <TrendChart
              series={[
                {
                  label: "Hours slept",
                  values: sleep.map((row) => round1(row.minutes / 60)),
                  emphasis: true,
                },
              ]}
              labels={sleep.map((row) => row.date)}
            />
          </div>
        ) : (
          <p className="text-muted-foreground mt-4 border-t pt-4 text-xs">
            Record two or more nights and a trend appears here.
          </p>
        )}
      </section>

      <section className="bg-card shadow-card rounded-xl border p-4">
        <h2 className="text-sm font-medium">Your average</h2>
        {average === null ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Nothing recorded yet.
          </p>
        ) : (
          <>
            <p className="tabular mt-2 font-mono text-2xl font-medium">
              {Math.floor(average / 60)}h {average % 60}m
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Across {sleep.length} night{sleep.length === 1 ? "" : "s"} recorded.
            </p>
            <p className="text-muted-foreground mt-3 border-t pt-2 text-2xs leading-relaxed">
              Sleep feeds the time budget on your twin home: a short night means the planner
              offers you a lighter day, not a lecture.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
