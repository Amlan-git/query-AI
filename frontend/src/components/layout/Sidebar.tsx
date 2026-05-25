import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, LogOut, MessageSquare } from "lucide-react";

type Conversation = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function Sidebar() {
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
            // Sort by updated time or as received from API
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
  }, [location.pathname]); // List updates on every page transition (e.g. completion of search)

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleNewSearch = () => {
    navigate("/search");
  };

  return (
    <aside className="w-[260px] h-full flex flex-col border-r border-border/80 bg-card/20 backdrop-blur-md text-foreground select-none shrink-0 overflow-hidden">
      {/* 1. App Branding Header */}
      <div className="p-5 pb-4 flex items-center gap-2">
        <div className="flex size-7.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4.5" />
        </div>
        <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/85 bg-clip-text text-transparent">
          Quest
        </span>
      </div>

      {/* 2. New Search CTA Option */}
      <div className="px-3 mb-4">
        <Button
          onClick={handleNewSearch}
          variant="outline"
          className="w-full justify-start gap-2.5 rounded-xl border border-border/70 bg-card/30 hover:bg-card/70 text-foreground/90 transition-all text-xs font-semibold py-5 cursor-pointer shadow-xs"
        >
          <Plus className="size-4 text-muted-foreground" />
          New Search
        </Button>
      </div>

      {/* 3. Conversation Thread Directory */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1.5 scrollbar-thin scrollbar-thumb-muted/30 scrollbar-track-transparent">
        <div className="px-3 py-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
            Recent Searches
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2 p-3">
            <div className="h-6 w-full animate-pulse rounded-md bg-muted/40" />
            <div className="h-6 w-3/4 animate-pulse rounded-md bg-muted/40" />
            <div className="h-6 w-5/6 animate-pulse rounded-md bg-muted/40" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center">
            <span className="text-xs font-light text-muted-foreground/75">
              No searches yet
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map((conv) => {
              const isActive = activeId === conv.id;
              
              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/search/${conv.id}`)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs transition-all duration-150 cursor-pointer select-none group focus:outline-none ${
                    isActive
                      ? "bg-card border border-border/80 text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-card/50 hover:text-foreground border border-transparent"
                  }`}
                >
                  <MessageSquare className={`size-3.5 shrink-0 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground/70"
                  }`} />
                  <span className="truncate flex-1">
                    {conv.title || "Untitled Search"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Authenticated User Badge & Logging Panel */}
      <div className="p-4 border-t border-border/70 bg-card/15 mt-auto flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="size-8.5 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 border border-primary/10">
            {userEmail ? userEmail.substring(0, 2).toUpperCase() : "Q"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground/90 truncate leading-none">
              {userEmail ? userEmail.split("@")[0] : "Quest User"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate leading-none mt-1">
              {userEmail || "Loading identity..."}
            </p>
          </div>
        </div>

        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start gap-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs py-4.5 cursor-pointer transition-colors"
        >
          <LogOut className="size-4" />
          Log Out
        </Button>
      </div>
    </aside>
  );
}
