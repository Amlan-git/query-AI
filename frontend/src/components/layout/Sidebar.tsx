import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, PanelLeftClose } from "lucide-react";

type Conversation = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  isMobile: boolean;
};

/**
 * Formats a date string into a human-readable relative timestamp.
 */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Sidebar({ isOpen, onClose, onToggle, isMobile }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId: activeId } = useParams<{ conversationId?: string }>();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Fetch conversations and user details on mount, and re-fetch on route transitions to keep lists synchronized
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUserEmail(session.user?.email ?? null);
          
          const response = await fetch("/conversations", {
            headers: {
              "Authorization": `Bearer ${session.access_token}`
            }
          });
          
          if (response.ok) {
            const json = await response.json();
            setConversations(json.data || []);
          }
        }
      } catch (err) {
        console.error("Sidebar initialization error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [location.pathname]);

  // Close sidebar on Escape key (mobile only)
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, isOpen, onClose]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate("/");
  }, [navigate]);

  const handleNewSearch = useCallback(() => {
    navigate("/search", { state: { newChat: true } });
    if (isMobile) onClose();
  }, [navigate, isMobile, onClose]);

  const handleSelectConversation = useCallback((convId: string) => {
    navigate(`/search/${convId}`);
    if (isMobile) onClose();
  }, [navigate, isMobile, onClose]);

  return (
    <aside
      className="w-[260px] h-full flex flex-col text-foreground select-none shrink-0 overflow-hidden"
      style={{ background: "oklch(0.08 0.015 245)" }}
      role="navigation"
      aria-label="Sidebar navigation"
    >
      {/* 1. Brand Header + Collapse Toggle */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/20 shadow-[0_0_12px_rgba(0,102,204,0.2)]">
            <span className="text-sm font-bold leading-none">Q</span>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-foreground/95">
            Query
          </span>
        </div>

        {/* Collapse button (desktop only) */}
        {!isMobile && (
          <button
            onClick={onToggle}
            className="flex items-center justify-center size-8 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-all duration-200 cursor-pointer"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {/* 2. New Chat CTA */}
      <div className="px-3 pt-2 pb-1">
        <Button
          onClick={handleNewSearch}
          variant="ghost"
          className="w-full justify-start gap-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.06] rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200"
        >
          <Plus className="size-4" />
          New chat
        </Button>
      </div>

      {/* 3. Section Label */}
      <div className="px-5 pt-4 pb-2">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
          Recent
        </span>
      </div>

      {/* 4. Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 scrollbar-thin">
        {loading ? (
          <div className="flex flex-col gap-1.5 p-2">
            <div className="h-9 w-full animate-pulse rounded-lg bg-white/[0.03]" />
            <div className="h-9 w-4/5 animate-pulse rounded-lg bg-white/[0.03]" />
            <div className="h-9 w-11/12 animate-pulse rounded-lg bg-white/[0.03]" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground/50 font-light">
              No conversations yet
            </p>
            <p className="text-[11px] text-muted-foreground/35 mt-1">
              Start a new chat to begin
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map((conv) => {
              const isActive = activeId === conv.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-[13px] transition-all duration-200 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    isActive
                      ? "bg-white/[0.08] text-foreground font-medium"
                      : "text-muted-foreground/80 hover:bg-white/[0.04] hover:text-foreground/90"
                  }`}
                >
                  {/* Active indicator bar */}
                  <span
                    className={`shrink-0 w-[3px] h-4 rounded-full transition-all duration-200 ${
                      isActive ? "bg-primary" : "bg-transparent group-hover:bg-white/10"
                    }`}
                  />

                  {/* Title + timestamp */}
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="truncate leading-tight">
                      {conv.title || "Untitled chat"}
                    </span>
                    <span className={`text-[10px] text-muted-foreground/40 leading-none transition-opacity duration-200 ${
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}>
                      {formatRelativeTime(conv.updatedAt || conv.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. User Badge + Logout */}
      <div className="p-3 mt-auto border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-1">
          {/* User avatar circle */}
          <div className="flex items-center justify-center size-7 rounded-full bg-primary/15 text-primary text-[11px] font-semibold shrink-0 border border-primary/10">
            {userEmail ? userEmail[0]?.toUpperCase() : "?"}
          </div>
          <span
            className="text-xs text-muted-foreground/70 truncate flex-1 min-w-0"
            title={userEmail || ""}
          >
            {userEmail || "Loading…"}
          </span>
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-all duration-200 shrink-0"
            title="Log Out"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
