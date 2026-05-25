import { useEffect } from "react";
import Sidebar from "./Sidebar";

type Props = {
  children: React.ReactNode;
};

export default function AppLayout({ children }: Props) {
  // Ensure that dark mode class is applied to the root document element
  // to align with the Quest Hub aesthetic and activate custom oklch variables
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-background">
      {/* Persistent Left Sidebar Navigation */}
      <Sidebar />

      {/* Primary Scrollable Content Area */}
      <main className="flex-1 h-full overflow-y-auto relative bg-background focus:outline-none">
        {children}
      </main>
    </div>
  );
}
