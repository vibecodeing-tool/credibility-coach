import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { FolderGate } from "@/components/folder-gate";

export function AppLayout({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Fullscreen, chrome-less view during a live interview.
  const isFullscreen = path.startsWith("/sessions/run/");

  if (isFullscreen) {
    return <div className="min-h-screen w-full bg-background">{children}</div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b bg-background/80 backdrop-blur px-3 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="font-display text-sm font-semibold tracking-tight">
              CAS Interview Simulator
            </div>
          </header>
          <main className="flex-1 min-w-0">
            <FolderGate>{children}</FolderGate>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
