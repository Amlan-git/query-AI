import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles } from "lucide-react";

type Props = {
  onSearch: (query: string) => void;
  isLoading: boolean;
  placeholder?: string;
};

export default function SearchBar({ onSearch, isLoading, placeholder }: Props) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    onSearch(trimmed);
    setQuery(""); // Clear input after successful submit
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-3xl mx-auto flex items-center gap-2 bg-card/40 backdrop-blur-sm border border-border/80 rounded-2xl p-1.5 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/30 transition-all duration-350 shadow-sm"
    >
      <div className="flex-1 flex items-center pl-2.5">
        <Search className="size-4.5 text-muted-foreground mr-2 shrink-0" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          placeholder={placeholder || "Ask anything..."}
          className="border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 p-0 text-foreground placeholder:text-muted-foreground/75 placeholder:font-light"
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading || !query.trim()}
        className="h-9 px-4 rounded-xl gap-2 font-medium bg-primary hover:bg-primary/95 text-primary-foreground shadow-xs cursor-pointer disabled:pointer-events-none transition-all duration-200"
      >
        <Sparkles className="size-3.5 animate-pulse" />
        <span className="text-xs">
          {isLoading ? "Searching..." : "Search"}
        </span>
      </Button>
    </form>
  );
}
