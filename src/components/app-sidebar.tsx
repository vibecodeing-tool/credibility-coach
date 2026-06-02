import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ListChecks, PlayCircle, History, FolderOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useFsRoot } from "@/hooks/use-fs-root";
import { Button } from "@/components/ui/button";

const nav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Questions", url: "/questions", icon: ListChecks },
  { title: "New Session", url: "/sessions/new", icon: PlayCircle },
  { title: "History", url: "/sessions", icon: History, exact: true },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { handle, clear } = useFsRoot();

  const isActive = (url: string, exact?: boolean) =>
    exact ? path === url : path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-display font-bold">
            C
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-semibold">CAS Sim</span>
            <span className="text-xs text-muted-foreground">Interview Trainer</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {handle && (
          <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
            <div className="rounded-md border bg-card p-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5" />
                <span>Data folder</span>
              </div>
              <div className="mt-1 truncate font-medium">{handle.name}</div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-7 w-full justify-start px-2 text-xs"
                onClick={() => clear()}
              >
                Change folder
              </Button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
