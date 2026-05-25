import { useState } from "react";
import { Copy, Check, Terminal, FileText, ChevronRight } from "lucide-react";

type Props = {
  answer: string;
  isStreaming: boolean;
};

export default function AnswerStream({ answer, isStreaming }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // 1. Inline parser for styling bold (**), italic (*), and inline code (`)
  const parseInlineStyles = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
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
      if (matchedText.startsWith("**") && matchedText.endsWith("**")) {
        parts.push(
          <strong key={i} className="font-bold text-foreground bg-gradient-to-r from-foreground to-foreground/90 bg-clip-text">
            {matchedText.slice(2, -2)}
          </strong>
        );
      } else if (matchedText.startsWith("*") && matchedText.endsWith("*")) {
        parts.push(
          <em key={i} className="italic text-foreground/80 font-medium">
            {matchedText.slice(1, -1)}
          </em>
        );
      } else if (matchedText.startsWith("`") && matchedText.endsWith("`")) {
        parts.push(
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-muted/40 border border-border/40 font-mono text-xs text-primary font-semibold">
            {matchedText.slice(1, -1)}
          </code>
        );
      }

      lastIndex = start + matchedText.length;
    });

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  // 2. Block-level parser for Code Blocks, Lists, Blockquotes, Headers, and Paragraphs
  const renderMarkdownBlocks = (markdown: string): React.ReactNode[] => {
    const lines = markdown.split("\n");
    const blocks: React.ReactNode[] = [];
    
    let inCodeBlock = false;
    let codeLanguage = "";
    let codeContent: string[] = [];
    
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const flushList = (key: number) => {
      if (listItems.length > 0) {
        blocks.push(
          <ul key={`list-${key}`} className="list-none space-y-2.5 my-4 pl-1">
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
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

      // B. Header Handling
      if (line.startsWith("### ")) {
        flushList(i);
        blocks.push(
          <h3 key={i} className="text-base md:text-lg font-bold text-foreground tracking-tight mt-6 mb-3 leading-snug flex items-center gap-1.5">
            {parseInlineStyles(line.slice(4))}
          </h3>
        );
        continue;
      }

      if (line.startsWith("## ")) {
        flushList(i);
        blocks.push(
          <h2 key={i} className="text-lg md:text-xl font-extrabold text-foreground tracking-tight mt-8 mb-4 leading-snug border-b border-border/10 pb-1.5">
            {parseInlineStyles(line.slice(3))}
          </h2>
        );
        continue;
      }

      if (line.startsWith("# ")) {
        flushList(i);
        blocks.push(
          <h1 key={i} className="text-xl md:text-2xl font-black text-foreground tracking-tight mt-9 mb-4 leading-normal">
            {parseInlineStyles(line.slice(2))}
          </h1>
        );
        continue;
      }

      // C. Blockquote Handling
      if (line.startsWith("> ")) {
        flushList(i);
        blocks.push(
          <blockquote key={i} className="pl-4 border-l-3 border-primary/60 bg-primary/5 py-2 px-3 rounded-r-lg my-4 text-sm text-foreground/85 leading-relaxed font-light italic">
            {parseInlineStyles(line.slice(2))}
          </blockquote>
        );
        continue;
      }

      // D. Bullet List Handling
      const listMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
      if (listMatch) {
        inList = true;
        const content = listMatch[3];
        listItems.push(
          <li key={`li-${i}`} className="flex items-start gap-2.5 text-foreground/90 text-sm md:text-base leading-relaxed pl-1">
            <ChevronRight className="size-4 text-primary shrink-0 mt-1 select-none" />
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
        continue;
      }

      // F. Standard Paragraph Handling
      blocks.push(
        <p key={i} className="text-foreground/90 text-sm md:text-base leading-relaxed tracking-wide my-3.5 font-sans break-words font-light">
          {parseInlineStyles(line)}
        </p>
      );
    }

    // Flush any trailing lists
    flushList(lines.length);

    return blocks;
  };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6 py-6 px-1 animate-fade-in group">
      
      {/* 1. Header Metadata Section (Appears after answer completes) */}
      {!isStreaming && answer && (
        <div className="flex items-center justify-between pb-3.5 border-b border-border/30 select-none">
          <div className="flex items-center gap-2">
            <FileText className="size-4.5 text-primary/80 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/90 bg-clip-text">
              Answer Analysis
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card/25 hover:bg-card/75 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer shadow-xs"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500 animate-bounce" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy Answer</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 2. Structured Markdown Output Rendering */}
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
