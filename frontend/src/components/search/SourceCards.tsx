import { Card } from "@/components/ui/card";
import { ExternalLink, Globe } from "lucide-react";

type Source = {
  url: string;
  title: string;
  snippet?: string;
};

type Props = {
  sources: Source[];
};

export default function SourceCards({ sources }: Props) {
  const displaySources = sources
    .filter((source) => source.url || source.title)
    .slice(0, 8);

  if (displaySources.length === 0) return null;

  return (
    <section className="w-full animate-fade-in">
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <Globe className="size-3.5 text-muted-foreground/75" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/75">
          Links
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {displaySources.map((source, index) => {
          let hostname = "";
          let faviconUrl = "";
          
          try {
            hostname = new URL(source.url).hostname;
            faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
          } catch {
            hostname = source.url;
          }

          const cleanDomain = hostname.replace(/^www\./, "");
          const title = source.title || cleanDomain || "Web Search Reference";
          const snippet = source.snippet?.replace(/\s+/g, " ").trim();
          const hasUrl = Boolean(source.url);

          return (
            <a
              key={index}
              href={hasUrl ? source.url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="block min-w-0 no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              aria-label={`Open source ${index + 1}: ${title}`}
            >
              <Card className="group h-[92px] gap-0 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.045] p-3 shadow-none transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.07]">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {faviconUrl ? (
                      <img
                        src={faviconUrl}
                        alt=""
                        className="size-4 shrink-0 rounded-sm object-contain bg-muted/20"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <Globe className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-[11px] font-medium text-muted-foreground">
                      {cleanDomain || "Source"}
                    </span>
                  </div>
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background/45 text-[10px] font-semibold text-muted-foreground/80">
                    {index + 1}
                  </span>
                </div>

                <h3 className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-foreground/92 group-hover:text-foreground">
                  {title}
                </h3>

                {snippet ? (
                  <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-muted-foreground/65">
                    {snippet}
                  </p>
                ) : hasUrl && (
                  <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/55">
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">{source.url}</span>
                  </div>
                )}
              </Card>
            </a>
          );
        })}
      </div>
    </section>
  );
}
