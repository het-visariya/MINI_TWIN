"use client";

import { Info } from "lucide-react";

import { FieldError } from "@/components/auth/fields";
import { Choice, Field, Row, Toggle } from "@/components/onboarding/controls";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ageOn, ageSafety } from "@/lib/auth/age";
import type { OnboardingSlug } from "@/lib/onboarding/steps";

export type SavedAnswers = {
  name: string;
  lifeStage: string | null;
  regreterTone: string;
  sex: string | null;
  hasMedicalCondition: boolean;
  aiConsent: boolean;
  allowHealthDataToAi: boolean;
  allowMoneyDataToAi: boolean;
  traits: Record<string, unknown>;
};

export function StepFields({
  slug,
  saved,
  dob,
  errors,
}: {
  slug: OnboardingSlug;
  saved: SavedAnswers;
  dob: string;
  errors: Record<string, string>;
}) {
  const trait = (key: string) => {
    const value = saved.traits[key];
    return value === undefined || value === null ? "" : String(value);
  };

  const age = ageOn(new Date(dob));
  const safety = ageSafety(age);

  switch (slug) {
    case "about-you":
      return (
        <div className="space-y-4">
          <Field label="Your name" error={errors.name}>
            <Input name="name" defaultValue={saved.name} required autoComplete="name" />
          </Field>
          <Field
            label="Pronouns"
            hint="Optional. Your twin uses these when it talks about you."
            error={errors.pronouns}
          >
            <Input name="pronouns" defaultValue={trait("pronouns")} placeholder="they/them" />
          </Field>
        </div>
      );

    case "life-stage":
      return (
        <Choice
          name="lifeStage"
          defaultValue={saved.lifeStage ?? "COLLEGE"}
          error={errors.lifeStage}
          options={[
            { value: "SCHOOL", label: "School", hint: "Classes, exams, attendance" },
            {
              value: "COLLEGE",
              label: "College or university",
              hint: "Subjects, credits, internals, CGPA",
            },
            {
              value: "OTHER",
              label: "Working or something else",
              hint: "Skip the academic questions",
            },
          ]}
        />
      );

    case "academics":
      return (
        <div className="space-y-4">
          <Field label="Where are you studying?" error={errors.institution}>
            <Input name="institution" defaultValue={trait("institution")} />
          </Field>
          <Field
            label="Your subjects"
            hint="One per line. You can add timetables, credits and difficulty later."
            error={errors.subjects}
          >
            <Textarea
              name="subjects"
              rows={5}
              defaultValue={trait("subjects")}
              placeholder={"DBMS\nOperating Systems\nComputer Networks"}
            />
          </Field>
          <Field
            label="Minimum attendance required"
            hint="Your twin uses this for the bunk budget — how many classes you can still miss."
            error={errors.minAttendancePct}
          >
            <Row>
              <Input
                name="minAttendancePct"
                type="number"
                min={0}
                max={100}
                defaultValue={trait("minAttendancePct") || "75"}
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">per cent</span>
            </Row>
          </Field>
        </div>
      );

    case "health":
      return (
        <div className="space-y-4">
          <Row>
            <Field label="Height" error={errors.heightCm}>
              <Row>
                <Input
                  name="heightCm"
                  type="number"
                  step="0.5"
                  defaultValue={trait("heightCm")}
                  className="w-24"
                />
                <span className="text-muted-foreground text-sm">cm</span>
              </Row>
            </Field>
            <Field label="Weight" error={errors.weightKg}>
              <Row>
                <Input
                  name="weightKg"
                  type="number"
                  step="0.1"
                  defaultValue={trait("weightKg")}
                  className="w-24"
                />
                <span className="text-muted-foreground text-sm">kg</span>
              </Row>
            </Field>
          </Row>

          {safety.usesBmiForAge && (
            <>
              <Choice
                name="sex"
                label="Sex"
                hint="Asked only because BMI under 20 is read as a percentile for your age and sex, not as an adult BMI number."
                defaultValue={saved.sex ?? "PREFER_NOT_TO_SAY"}
                error={errors.sex}
                options={[
                  { value: "FEMALE", label: "Female" },
                  { value: "MALE", label: "Male" },
                  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
                ]}
              />
              <Note>
                You are under 20, so your twin will not set weight-loss or calorie
                targets. It tracks what you log and nothing more.
              </Note>
            </>
          )}

          <Field label="Gym days a week" error={errors.gymDaysPerWeek}>
            <Input
              name="gymDaysPerWeek"
              type="number"
              min={0}
              max={7}
              defaultValue={trait("gymDaysPerWeek")}
              className="w-24"
            />
          </Field>

          <Choice
            name="dietType"
            label="How do you eat?"
            defaultValue={trait("dietType") || "vegetarian"}
            error={errors.dietType}
            options={[
              { value: "vegetarian", label: "Vegetarian" },
              { value: "eggetarian", label: "Eggetarian" },
              { value: "non-vegetarian", label: "Non-vegetarian" },
              { value: "vegan", label: "Vegan" },
            ]}
          />

          <Field
            label="Anything you are allergic to?"
            hint="Your twin warns you before saving a meal that contains one of these."
            error={errors.allergies}
          >
            <Input name="allergies" defaultValue={trait("allergies")} placeholder="peanuts, shellfish" />
          </Field>

          <Toggle
            name="hasMedicalCondition"
            defaultChecked={saved.hasMedicalCondition}
            label="I have a medical condition that affects food or exercise"
            hint="Turning this on makes your twin stop suggesting targets and point you to a doctor instead."
          />

          <Note>
            Digital Twin is not a medical device and nothing it shows you is medical
            advice. Talk to a doctor before changing how you eat or train.
          </Note>
        </div>
      );

    case "routine":
      return (
        <div className="space-y-4">
          <Row>
            <Field label="You usually wake at" error={errors.wakeHour}>
              <Input
                name="wakeHour"
                type="number"
                min={0}
                max={23}
                defaultValue={trait("wakeHour") || "7"}
                className="w-24"
                required
              />
            </Field>
            <Field label="You usually sleep at" error={errors.sleepHour}>
              <Input
                name="sleepHour"
                type="number"
                min={0}
                max={23}
                defaultValue={trait("sleepHour") || "23"}
                className="w-24"
                required
              />
            </Field>
          </Row>

          <Field
            label="Commute, both ways"
            hint="Subtracted from the hours your day actually has."
            error={errors.commuteMinutes}
          >
            <Row>
              <Input
                name="commuteMinutes"
                type="number"
                min={0}
                max={300}
                defaultValue={trait("commuteMinutes") || "0"}
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">minutes</span>
            </Row>
          </Field>

          <Choice
            name="chronotype"
            label="When do you actually get things done?"
            hint="Your twin schedules your hardest work here instead of fighting you."
            defaultValue={trait("chronotype") || "unsure"}
            error={errors.chronotype}
            options={[
              { value: "morning", label: "Mornings" },
              { value: "night", label: "Late at night" },
              { value: "unsure", label: "Not sure yet" },
            ]}
          />

          <Field label="A study block that suits you" error={errors.studyBlockMinutes}>
            <Row>
              <Input
                name="studyBlockMinutes"
                type="number"
                min={15}
                max={180}
                step={5}
                defaultValue={trait("studyBlockMinutes") || "50"}
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">minutes</span>
            </Row>
          </Field>
        </div>
      );

    case "money":
      return (
        <div className="space-y-4">
          <Field label="Money coming in each month" error={errors.monthlyIncomeRupees}>
            <Row>
              <span className="text-muted-foreground text-sm">₹</span>
              <Input
                name="monthlyIncomeRupees"
                type="number"
                min={0}
                defaultValue={trait("monthlyIncomeRupees")}
                className="w-36"
              />
            </Row>
          </Field>
          <Field label="What you want to keep spending under" error={errors.monthlyBudgetRupees}>
            <Row>
              <span className="text-muted-foreground text-sm">₹</span>
              <Input
                name="monthlyBudgetRupees"
                type="number"
                min={0}
                defaultValue={trait("monthlyBudgetRupees")}
                className="w-36"
              />
            </Row>
          </Field>
          <Field label="Saving up for anything?" error={errors.savingGoal}>
            <Input name="savingGoal" defaultValue={trait("savingGoal")} placeholder="AWS certification fee" />
          </Field>
          <Note>
            Tracking only. Digital Twin never connects to a bank and nothing here is
            financial advice.
          </Note>
        </div>
      );

    case "career":
      return (
        <div className="space-y-4">
          <Field
            label="The role you are aiming at"
            hint="Your twin shows the gap between your skills now and that role."
            error={errors.targetRole}
          >
            <Input name="targetRole" defaultValue={trait("targetRole")} placeholder="Backend developer" />
          </Field>
          <Field label="When do you finish studying?" error={errors.gradYear}>
            <Input
              name="gradYear"
              type="number"
              min={1980}
              max={2100}
              defaultValue={trait("gradYear")}
              className="w-28"
            />
          </Field>
        </div>
      );

    case "tone":
      return (
        <div className="space-y-4">
          <Choice
            name="regreterTone"
            defaultValue={saved.regreterTone}
            error={errors.regreterTone}
            options={[
              { value: "GENTLE", label: "Gentle", hint: "“Whenever you are ready.”" },
              { value: "BALANCED", label: "Balanced", hint: "“This is due tomorrow — want to start?”" },
              { value: "DIRECT", label: "Direct", hint: "“Two hours left and it is due tomorrow.”" },
              {
                value: "NO_MERCY",
                label: "No mercy",
                hint: "“You have moved this three times. Tomorrow costs you 2 hours.”",
              },
            ]}
          />
          <Choice
            name="motivationStyle"
            label="What actually gets you moving?"
            defaultValue={trait("motivationStyle") || "facts"}
            error={errors.motivationStyle}
            options={[
              { value: "encouragement", label: "Encouragement" },
              { value: "facts", label: "Plain facts" },
              { value: "deadlines", label: "Deadlines" },
            ]}
          />
          <Note>
            However direct you set this, your twin will never insult you or compare
            you with anyone else. You can change it any time in Settings.
          </Note>
        </div>
      );

    case "privacy":
      return (
        <div className="space-y-4">
          <Toggle
            name="aiConsent"
            defaultChecked={saved.aiConsent}
            label="My twin may use AI to answer my questions"
            hint="Without this, your twin still works — it does the maths on your numbers, it just cannot answer in sentences."
          />
          <Toggle
            name="allowHealthDataToAi"
            defaultChecked={saved.allowHealthDataToAi}
            label="Include my health and nutrition logs"
            hint="Off by default. Leave it off and health data never leaves the app."
          />
          <Toggle
            name="allowMoneyDataToAi"
            defaultChecked={saved.allowMoneyDataToAi}
            label="Include my spending and budget"
            hint="Off by default."
          />
          <Note>
            Every request is written down. Settings shows you exactly what was sent,
            when and for which feature — and you can export or delete all of it.
          </Note>
        </div>
      );

    case "meet-your-twin":
      return null;
  }
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground bg-surface-2/60 flex gap-2 rounded-lg border p-3 text-xs leading-relaxed">
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export { FieldError };
