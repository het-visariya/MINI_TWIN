/**
 * Starting points for a target role.
 *
 * These are **conventions, not measurements**. Nobody surveyed employers to
 * produce them; they are a reasonable first draft of what each role tends to
 * ask for, so a user does not face an empty form. Picking a role copies these
 * into editable `RoleSkillRequirement` rows, and the UI says plainly that they
 * are a starting point the user should correct.
 *
 * Levels are the same 1–5 scale the user rates themselves on:
 *   1 aware · 2 can follow a tutorial · 3 can build with it · 4 confident
 *   unaided · 5 can teach it
 */

export type RoleTemplate = {
  id: string;
  label: string;
  /** One line on who the role is, shown under the picker. */
  blurb: string;
  skills: { skill: string; requiredLevel: number }[];
};

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "backend",
    label: "Backend developer",
    blurb: "Server-side APIs, databases and the things that have to stay up.",
    skills: [
      { skill: "A backend language (Java, Go, Python or Node)", requiredLevel: 4 },
      { skill: "SQL and schema design", requiredLevel: 4 },
      { skill: "REST and API design", requiredLevel: 4 },
      { skill: "Git", requiredLevel: 3 },
      { skill: "Testing", requiredLevel: 3 },
      { skill: "Linux and the shell", requiredLevel: 3 },
      { skill: "Caching and queues", requiredLevel: 2 },
      { skill: "Data structures and algorithms", requiredLevel: 4 },
    ],
  },
  {
    id: "frontend",
    label: "Frontend developer",
    blurb: "What the user actually touches, and how fast it feels.",
    skills: [
      { skill: "HTML and CSS", requiredLevel: 4 },
      { skill: "JavaScript and TypeScript", requiredLevel: 4 },
      { skill: "React", requiredLevel: 4 },
      { skill: "Accessibility", requiredLevel: 3 },
      { skill: "Git", requiredLevel: 3 },
      { skill: "Browser performance", requiredLevel: 3 },
      { skill: "Testing", requiredLevel: 3 },
      { skill: "Design sense and layout", requiredLevel: 3 },
    ],
  },
  {
    id: "fullstack",
    label: "Full-stack developer",
    blurb: "Both ends of one product, usually in a small team.",
    skills: [
      { skill: "JavaScript and TypeScript", requiredLevel: 4 },
      { skill: "React", requiredLevel: 3 },
      { skill: "A backend framework", requiredLevel: 3 },
      { skill: "SQL and schema design", requiredLevel: 3 },
      { skill: "REST and API design", requiredLevel: 3 },
      { skill: "Git", requiredLevel: 3 },
      { skill: "Deployment and CI", requiredLevel: 3 },
      { skill: "Data structures and algorithms", requiredLevel: 3 },
    ],
  },
  {
    id: "data-analyst",
    label: "Data analyst",
    blurb: "Turning the company's data into decisions people act on.",
    skills: [
      { skill: "SQL", requiredLevel: 4 },
      { skill: "Spreadsheets", requiredLevel: 4 },
      { skill: "Python with pandas", requiredLevel: 3 },
      { skill: "Statistics", requiredLevel: 3 },
      { skill: "Data visualisation", requiredLevel: 4 },
      { skill: "A BI tool (Power BI, Tableau or Looker)", requiredLevel: 3 },
      { skill: "Communicating findings", requiredLevel: 4 },
    ],
  },
  {
    id: "data-scientist",
    label: "Data scientist",
    blurb: "Modelling and experiments, with the statistics to back them.",
    skills: [
      { skill: "Python", requiredLevel: 4 },
      { skill: "Statistics and probability", requiredLevel: 4 },
      { skill: "SQL", requiredLevel: 3 },
      { skill: "Machine learning fundamentals", requiredLevel: 4 },
      { skill: "Experiment design", requiredLevel: 3 },
      { skill: "Data visualisation", requiredLevel: 3 },
      { skill: "Linear algebra and calculus", requiredLevel: 3 },
    ],
  },
  {
    id: "ml-engineer",
    label: "ML engineer",
    blurb: "Getting models into production and keeping them honest there.",
    skills: [
      { skill: "Python", requiredLevel: 4 },
      { skill: "Machine learning fundamentals", requiredLevel: 4 },
      { skill: "PyTorch or TensorFlow", requiredLevel: 3 },
      { skill: "Software engineering practice", requiredLevel: 4 },
      { skill: "Data pipelines", requiredLevel: 3 },
      { skill: "Docker and deployment", requiredLevel: 3 },
      { skill: "Model evaluation and monitoring", requiredLevel: 3 },
    ],
  },
  {
    id: "devops",
    label: "DevOps / SRE",
    blurb: "The path from a commit to something running, and staying running.",
    skills: [
      { skill: "Linux and the shell", requiredLevel: 4 },
      { skill: "Networking basics", requiredLevel: 3 },
      { skill: "Docker", requiredLevel: 4 },
      { skill: "CI/CD pipelines", requiredLevel: 4 },
      { skill: "A cloud provider (AWS, GCP or Azure)", requiredLevel: 3 },
      { skill: "Infrastructure as code", requiredLevel: 3 },
      { skill: "Monitoring and alerting", requiredLevel: 3 },
      { skill: "Scripting (Python or Bash)", requiredLevel: 3 },
    ],
  },
  {
    id: "ui-ux",
    label: "UI/UX designer",
    blurb: "Deciding what the thing should be before anyone builds it.",
    skills: [
      { skill: "Figma", requiredLevel: 4 },
      { skill: "Typography and layout", requiredLevel: 4 },
      { skill: "Interaction design", requiredLevel: 4 },
      { skill: "User research", requiredLevel: 3 },
      { skill: "Accessibility", requiredLevel: 3 },
      { skill: "Prototyping", requiredLevel: 3 },
      { skill: "Design systems", requiredLevel: 3 },
      { skill: "Presenting work", requiredLevel: 3 },
    ],
  },
];

export function findRoleTemplate(id: string): RoleTemplate | undefined {
  return ROLE_TEMPLATES.find((template) => template.id === id);
}

/** Every distinct skill across all templates, for the skills editor's suggestions. */
export const ALL_TEMPLATE_SKILLS: string[] = [
  ...new Set(ROLE_TEMPLATES.flatMap((role) => role.skills.map((s) => s.skill))),
].sort((a, b) => a.localeCompare(b));
