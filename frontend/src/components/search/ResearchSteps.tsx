import { ChevronRight, CloudDownload, Globe2, Sparkles } from "lucide-react";

type Props = {
  query: string;
  isStreaming: boolean;
  sourceCount?: number;
};

function summarizeQuery(query: string) {
  const cleaned = query
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "relevant sources";

  const words = cleaned.split(" ").filter(Boolean);
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "best",
    "for",
    "how",
    "in",
    "is",
    "of",
    "on",
    "the",
    "to",
    "what",
    "which",
    "with"
  ]);
  const meaningfulWords = words.filter((word) => !stopWords.has(word.toLowerCase()));
  const phrase = (meaningfulWords.length > 0 ? meaningfulWords : words).slice(0, 6).join(" ");

  return phrase || "relevant sources";
}

export default function ResearchSteps({ query, isStreaming, sourceCount = 0 }: Props) {
  const querySummary = summarizeQuery(query);
  const completedCount = sourceCount > 0 ? 3 : 2;

  if (!isStreaming) {
    return (
      <button
        type="button"
        className="group mb-5 inline-flex items-center gap-2 rounded-full text-sm font-semibold text-muted-foreground/75 transition-colors hover:text-foreground/85"
        aria-label={`Completed ${completedCount} research steps`}
      >
        <span>Completed {completedCount} steps</span>
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    );
  }

  const steps = [
    {
      icon: Globe2,
      label: "Searching the web",
      active: true
    },
    {
      icon: CloudDownload,
      label: `Reading sources for ${querySummary}`,
      active: sourceCount > 0
    },
    {
      icon: Sparkles,
      label: "Synthesizing answer",
      active: true
    }
  ];

  return (
    <div className="mb-5 flex flex-col gap-3 text-sm text-muted-foreground/78" aria-label="Research progress">
      {steps.map((step) => {
        const Icon = step.icon;

        return (
          <div
            key={step.label}
            className={`group flex min-h-6 items-center gap-3 transition-colors ${
              step.active ? "text-foreground/68" : "text-muted-foreground/48"
            }`}
          >
            <Icon className={`size-4 shrink-0 ${step.active ? "text-primary/80" : "text-muted-foreground/45"}`} />
            <span className="truncate leading-6">{step.label}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/45 transition-transform group-hover:translate-x-0.5" />
          </div>
        );
      })}
    </div>
  );
}
