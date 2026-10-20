import { AskAboutThis } from "@/components/patterns/ask-about-this";

export function PageHeader({
  title,
  description,
  askAbout,
  actions,
}: {
  title: string;
  description: string;
  /** Subject carried into the twin conversation. */
  askAbout?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {askAbout && <AskAboutThis subject={askAbout} />}
      </div>
    </header>
  );
}
