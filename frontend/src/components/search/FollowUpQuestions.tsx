import { ChevronRight } from "lucide-react";

type Props = {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
};

export default function FollowUpQuestions({ questions, onSelect, disabled }: Props) {
  const displayQuestions = questions.map((question) => question.trim()).filter(Boolean).slice(0, 5);

  if (displayQuestions.length === 0) return null;

  return (
    <section className="w-full animate-fade-in">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/75">
        Related
      </h2>
      <div className="grid gap-2">
        {displayQuestions.map((question, index) => (
          <button
            key={`${question}-${index}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(question)}
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 text-left text-sm font-medium text-foreground/88 transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{question}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/80" />
          </button>
        ))}
      </div>
    </section>
  );
}
