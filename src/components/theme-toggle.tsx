import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={className}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="ml-2 group-data-[collapsible=icon]:hidden">
        {isDark ? "Light mode" : "Dark mode"}
      </span>
    </Button>
  );
}
