import { Card } from "@/components/ui/card";
import { Globe } from "lucide-react";

type Source = {
  url: string;
  title: string;
};

type Props = {
  sources: Source[];
};

export default function SourceCards({ sources }: Props) {
  // Limit to maximum of 5 sources to match Perplexity UX
  const displaySources = sources.slice(0, 5);

  if (displaySources.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-2 mt-4 animate-fade-in">
      <div className="flex items-center gap-1.5 px-1">
        <Globe className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sources
        </span>
      </div>
      
      {/* Horizontally scrollable row with custom padding for cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-muted/30 scrollbar-track-transparent">
        {displaySources.map((source, index) => {
          let hostname = "";
          let faviconUrl = "";
          
          try {
            hostname = new URL(source.url).hostname;
            faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
          } catch {
            hostname = source.url;
          }

          return (
            <a
              key={index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none block no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg transition-transform active:scale-98"
            >
              <Card className="w-48 h-[74px] p-3 flex flex-col justify-between border bg-card/45 backdrop-blur-xs hover:bg-card/75 hover:border-primary/30 transition-all duration-200 cursor-pointer">
                {/* Source Title (Truncated to 1 line) */}
                <h4 className="text-xs font-medium text-foreground line-clamp-1 leading-tight break-all">
                  {source.title || "Web Search Reference"}
                </h4>
                
                {/* Favicon & Domain Name */}
                <div className="flex items-center gap-2 mt-1.5">
                  {faviconUrl ? (
                    <img
                      src={faviconUrl}
                      alt=""
                      className="size-3.5 rounded-sm object-contain bg-muted/20"
                      onError={(e) => {
                        // If Google favicon fails, fall back to empty or hidden
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <Globe className="size-3 text-muted-foreground" />
                  )}
                  <span className="text-[10px] text-muted-foreground truncate font-mono">
                    {hostname.replace("www.", "")}
                  </span>
                </div>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}
