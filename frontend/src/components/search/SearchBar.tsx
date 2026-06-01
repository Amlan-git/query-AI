import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowUp, Loader2, Plus } from "lucide-react";

type Props = {
  onSearch: (query: string) => void;
  isLoading: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function SearchBar({ onSearch, isLoading, placeholder, autoFocus }: Props) {
  const [query, setQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize handler
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${newHeight}px`;
  }, [query]);

  // Auto-focus on mount when requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      // Small delay to ensure DOM is ready after transitions
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    onSearch(trimmed);
    setQuery(""); // Clear input after successful submit
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed || isLoading) return;

      onSearch(trimmed);
      setQuery(""); // Clear input after successful submit
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[640px] mx-auto flex items-end gap-0 rounded-[26px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl transition-all duration-300 focus-within:border-white/[0.15] focus-within:bg-white/[0.06] focus-within:shadow-[0_0_40px_rgba(100,140,255,0.08)] relative overflow-hidden"
      style={{
        boxShadow: "0 2px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Leading action button */}
      <button
        type="button"
        className="flex items-center justify-center size-11 ml-1.5 mb-1.5 shrink-0 rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/[0.06] transition-all duration-200 cursor-pointer self-end"
        aria-label="Add attachment"
        tabIndex={-1}
      >
        <Plus className="size-5" />
      </button>

      {/* Text input */}
      <Textarea
        ref={textareaRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder={placeholder || "Ask anything…"}
        className="border-0 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:ring-0 bg-transparent shadow-none resize-none min-h-[48px] max-h-[160px] py-3.5 px-1 text-[15px] leading-relaxed w-full text-foreground placeholder:text-muted-foreground/40 font-light"
        aria-label="Search query"
      />

      {/* Trailing send button */}
      <Button
        type="submit"
        disabled={isLoading || !query.trim()}
        className="flex items-center justify-center size-9 mr-2 mb-2 shrink-0 rounded-full bg-white/[0.1] hover:bg-white/[0.18] disabled:opacity-20 disabled:hover:bg-white/[0.1] text-foreground/90 cursor-pointer p-0 transition-all duration-250 self-end border-0 shadow-none"
        aria-label={isLoading ? "Searching…" : "Submit search"}
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowUp className="size-4" />
        )}
      </Button>
    </form>
  );
}
