import { Copy, Terminal, ChevronRight, Hash } from "lucide-react";

type Source = {
  url: string;
  title: string;
  snippet?: string;
};

type Props = {
  answer: string;
  isStreaming: boolean;
  sources: Source[];
};

export default function AnswerStream({ answer, isStreaming, sources }: Props) {
  // 1. Inline parser for styling links, citations, bold, italic, and inline code.
  const parseInlineStyles = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\n]+)\*|(?<!\!)\[(\d+)\])/g;
    const matches = [...text.matchAll(regex)];

    if (matches.length === 0) {
      return [text];
    }

    let lastIndex = 0;
    matches.forEach((match, i) => {
      const start = match.index!;
      const matchedText = match[0];

      // Add preceding plain text
      if (start > lastIndex) {
        parts.push(text.slice(lastIndex, start));
      }

      // Add styled token
      if (match[2] && match[3]) {
        parts.push(
          <a
            key={i}
            href={match[3]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-3 decoration-primary/45 hover:decoration-primary transition-colors"
          >
            {match[2]}
          </a>
        );
      } else if (match[4]) {
        parts.push(
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-muted/40 border border-border/40 font-mono text-xs text-primary font-semibold">
            {match[4]}
          </code>
        );
      } else if (match[5]) {
        parts.push(
          <strong key={i} className="font-bold text-foreground bg-gradient-to-r from-foreground to-foreground/90 bg-clip-text">
            {match[5]}
          </strong>
        );
      } else if (match[6]) {
        parts.push(
          <em key={i} className="italic text-foreground/80 font-medium">
            {match[6]}
          </em>
        );
      } else if (match[7]) {
        const citationNumber = Number(match[7]);
        const source = Number.isFinite(citationNumber) ? sources[citationNumber - 1] : undefined;
        const citationClassName = "mx-0.5 inline-flex translate-y-[-1px] items-center gap-0.5 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary transition-colors hover:border-primary/35 hover:bg-primary/15";

        if (source?.url) {
          parts.push(
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              title={source.title || source.url}
              className={citationClassName}
            >
              <Hash className="size-2.5" />
              {match[7]}
            </a>
          );
        } else {
        parts.push(
          <span
            key={i}
            className={citationClassName}
          >
            <Hash className="size-2.5" />
            {match[7]}
          </span>
        );
        }
      }

      lastIndex = start + matchedText.length;
    });

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  const isTableDivider = (line: string) =>
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

  const parseTableRow = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  // 2. Block-level parser for Code Blocks, Lists, Tables, Blockquotes, Headers, and Paragraphs.
  const renderMarkdownBlocks = (markdown: string): React.ReactNode[] => {
    const lines = markdown.split("\n");
    const blocks: React.ReactNode[] = [];
    
    let inCodeBlock = false;
    let codeLanguage = "";
    let codeContent: string[] = [];
    
    let inList = false;
    let listItems: React.ReactNode[] = [];
    let listType: "ul" | "ol" = "ul";
    let paragraphLines: string[] = [];

    const flushParagraph = (key: number) => {
      if (paragraphLines.length === 0) return;

      blocks.push(
        <p key={`p-${key}`} className="my-3.5 break-words text-[17px] font-light leading-8 text-foreground/88">
          {parseInlineStyles(paragraphLines.join(" "))}
        </p>
      );
      paragraphLines = [];
    };

    const flushList = (key: number) => {
      if (listItems.length > 0) {
        const ListTag = listType;
        blocks.push(
          <ListTag
            key={`list-${key}`}
            className={`${listType === "ol" ? "list-decimal pl-6" : "list-none pl-1"} space-y-2.5 my-4`}
          >
            {listItems}
          </ListTag>
        );
        listItems = [];
        inList = false;
        listType = "ul";
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // A. Code Block Handling
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          // Closing code block
          const fullCode = codeContent.join("\n");
          const currentLang = codeLanguage || "code";
          blocks.push(
            <div key={`code-${i}`} className="my-5 overflow-hidden rounded-xl border border-border/80 bg-card/35 backdrop-blur-md shadow-xs group/code">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/70 bg-card/50 text-[10px] font-mono text-muted-foreground/80 select-none">
                <div className="flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-primary/75" />
                  <span>{currentLang.toUpperCase()}</span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(fullCode)}
                  className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                >
                  <Copy className="size-3" />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-4 overflow-x-auto font-mono text-xs text-foreground/90 leading-relaxed bg-black/10">
                <code>{fullCode}</code>
              </pre>
            </div>
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          // Opening code block
          flushParagraph(i);
          flushList(i);
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // B. Table Handling
      if (
        i + 1 < lines.length &&
        line.includes("|") &&
        isTableDivider(lines[i + 1] || "")
      ) {
        flushParagraph(i);
        flushList(i);

        const headers = parseTableRow(line);
        const rows: string[][] = [];
        i += 2;

        while (i < lines.length && (lines[i] || "").includes("|") && (lines[i] || "").trim() !== "") {
          rows.push(parseTableRow(lines[i] || ""));
          i++;
        }
        i--;

        blocks.push(
          <div key={`table-${i}`} className="my-5 overflow-x-auto rounded-xl border border-border/70 bg-card/25">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="bg-card/60 text-foreground">
                <tr>
                  {headers.map((header, index) => (
                    <th key={index} className="border-b border-border/70 px-4 py-3 font-bold">
                      {parseInlineStyles(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-border/35 last:border-0">
                    {headers.map((_, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3 align-top text-foreground/85">
                        {parseInlineStyles(row[cellIndex] || "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // C. Horizontal Rule Handling
      if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
        flushParagraph(i);
        flushList(i);
        blocks.push(<hr key={`hr-${i}`} className="my-6 border-border/40" />);
        continue;
      }

      // B. Header Handling
      if (line.startsWith("### ")) {
        flushParagraph(i);
        flushList(i);
        blocks.push(
          <h3 key={i} className="mt-6 mb-3 flex items-center gap-1.5 text-[18px] font-medium leading-snug text-foreground/92">
            {parseInlineStyles(line.slice(4))}
          </h3>
        );
        continue;
      }

      if (line.startsWith("## ")) {
        flushParagraph(i);
        flushList(i);
        blocks.push(
          <h2 key={i} className="mt-8 mb-4 border-b border-border/10 pb-1.5 text-[20px] font-medium leading-snug text-foreground/94">
            {parseInlineStyles(line.slice(3))}
          </h2>
        );
        continue;
      }

      if (line.startsWith("# ")) {
        flushParagraph(i);
        flushList(i);
        blocks.push(
          <h1 key={i} className="mt-9 mb-4 text-[22px] font-semibold leading-normal text-foreground">
            {parseInlineStyles(line.slice(2))}
          </h1>
        );
        continue;
      }

      // C. Blockquote Handling
      if (line.startsWith("> ")) {
        flushParagraph(i);
        flushList(i);
        blocks.push(
          <blockquote key={i} className="pl-4 border-l-3 border-primary/60 bg-primary/5 py-2 px-3 rounded-r-lg my-4 text-sm text-foreground/85 leading-relaxed font-light italic">
            {parseInlineStyles(line.slice(2))}
          </blockquote>
        );
        continue;
      }

      // D. Bullet List Handling
      const unorderedListMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
      const orderedListMatch = line.match(/^(\s*)\d+[.)]\s+(.*)/);
      const listMatch = unorderedListMatch || orderedListMatch;
      if (listMatch) {
        flushParagraph(i);
        inList = true;
        const nextListType = orderedListMatch ? "ol" : "ul";
        if (listItems.length > 0 && listType !== nextListType) {
          flushList(i);
        }
        listType = nextListType;
        const content = listMatch[2] || "";
        listItems.push(
          <li key={`li-${i}`} className={`${listType === "ul" ? "flex gap-3 pl-1" : "pl-1"} text-[17px] font-light leading-8 text-foreground/88`}>
            {listType === "ul" && <ChevronRight className="size-4 text-primary shrink-0 mt-1 select-none" />}
            <span className="flex-1">{parseInlineStyles(content)}</span>
          </li>
        );
        continue;
      }

      // If we exit list layout and find a normal line, flush the list block
      if (line.trim() === "" || !listMatch) {
        flushList(i);
      }

      // E. Blank Lines
      if (line.trim() === "") {
        flushParagraph(i);
        continue;
      }

      // F. Standard Paragraph Handling
      paragraphLines.push(line.trim());
    }

    // Flush any trailing lists
    flushParagraph(lines.length);
    flushList(lines.length);

    // During streaming, render an unfinished fenced block instead of dropping it.
    if (inCodeBlock && codeContent.length > 0) {
      const fullCode = codeContent.join("\n");
      blocks.push(
        <div key="code-streaming" className="my-5 overflow-hidden rounded-xl border border-border/80 bg-card/35 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/70 bg-card/50 text-[10px] font-mono text-muted-foreground/80 select-none">
            <Terminal className="size-3.5 text-primary/75" />
            <span>{(codeLanguage || "code").toUpperCase()}</span>
          </div>
          <pre className="p-4 overflow-x-auto font-mono text-xs text-foreground/90 leading-relaxed bg-black/10">
            <code>{fullCode}</code>
          </pre>
        </div>
      );
    }

    return blocks;
  };

  return (
    <div className="w-full animate-fade-in px-0.5 pb-6">
      {/* Structured Markdown Output Rendering */}
      <div className="relative">
        <div className="space-y-1">
          {renderMarkdownBlocks(answer)}
        </div>
        
        {/* Typewriter Cursor */}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4.5 bg-primary rounded-xs animate-pulse ml-1.5 align-middle shadow-[0_0_8px_var(--primary)]" />
        )}
      </div>

    </div>
  );
}
