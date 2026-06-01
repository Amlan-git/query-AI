import { useEffect, useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Menu } from "lucide-react";

type Props = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Ensure that dark mode class is applied to the root document element
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Auto-close sidebar when switching to mobile viewport
  useEffect(() => {
    if (!isDesktop) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isDesktop]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-background">
      {/* Mobile backdrop overlay */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          style={{ animation: "backdrop-fade-in 200ms ease-out" }}
          onClick={handleCloseSidebar}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar — static on desktop, overlay drawer on mobile */}
      <div
        className={`
          ${isDesktop ? "relative" : "fixed inset-y-0 left-0 z-50"}
          ${!isDesktop && !sidebarOpen ? "pointer-events-none" : ""}
          h-full shrink-0
        `}
        style={
          !isDesktop
            ? {
                transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
              }
            : sidebarOpen
              ? { width: 260, transition: "width 280ms cubic-bezier(0.4, 0, 0.2, 1)" }
              : { width: 0, overflow: "hidden", transition: "width 280ms cubic-bezier(0.4, 0, 0.2, 1)" }
        }
      >
        <Sidebar
          isOpen={sidebarOpen}
          onClose={handleCloseSidebar}
          onToggle={handleToggleSidebar}
          isMobile={!isDesktop}
        />
      </div>

      {/* Primary Scrollable Content Area */}
      <main className="flex-1 h-full overflow-y-auto relative bg-background focus:outline-none">
        {/* Mobile header with menu toggle */}
        {!isDesktop && (
          <button
            onClick={handleToggleSidebar}
            className="fixed top-4 left-4 z-30 flex items-center justify-center size-10 rounded-xl bg-card/60 backdrop-blur-md border border-border/40 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-all duration-200 cursor-pointer shadow-lg"
            aria-label="Open sidebar menu"
          >
            <Menu className="size-5" />
          </button>
        )}

        {/* Desktop sidebar toggle when collapsed */}
        {isDesktop && !sidebarOpen && (
          <button
            onClick={handleToggleSidebar}
            className="fixed top-4 left-4 z-30 flex items-center justify-center size-9 rounded-lg bg-card/40 backdrop-blur-md border border-border/30 text-muted-foreground hover:text-foreground hover:bg-card/70 transition-all duration-200 cursor-pointer"
            aria-label="Open sidebar"
          >
            <Menu className="size-4.5" />
          </button>
        )}

        {children}
      </main>
    </div>
  );
}
