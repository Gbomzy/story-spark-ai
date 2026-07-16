import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wand2,
  Film,
  Mic,
  Music,
  ImageIcon,
  Search,
  LayoutTemplate,
  Settings,
  HelpCircle,
  Sparkles,
  Bot,
  ChevronLeft,
  Clapperboard,
  MonitorPlay,
  Cpu,
  Boxes,
  History,
  ListChecks,
  Activity,
  Download,
  Upload,
  AlertTriangle,
  Gauge,
  ShieldCheck,
  Flag,
  ScanText,
  Languages,
  Share2,
  Coins,
  BarChart3,
  Server,
  Bell,
  BookMarked,
  Workflow,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Primary navigation — the 6 items every user sees by default.
const primaryItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Create Movie", to: "/create-movie", icon: Wand2 },
  { label: "My Projects", to: "/projects", icon: FolderKanban },
  { label: "Render Queue", to: "/render-dashboard", icon: Activity },
  { label: "Publish", to: "/publishing", icon: Share2 },
  { label: "Billing", to: "/billing", icon: Coins },
] as const;

// Advanced Tools — collapsed by default. Everything Create Movie already
// covers lives here so it stays accessible for power users.
const advancedItems = [
  { label: "Story Generator", to: "/story-generator", icon: Wand2 },
  { label: "Character Creator", to: "/characters", icon: Users },
  { label: "Storyboard", to: "/storyboard", icon: Film },
  { label: "Voice Studio", to: "/voice-generator", icon: Mic },
  { label: "Song Studio", to: "/songs", icon: Music },
  { label: "Image Prompt Studio", to: "/image-prompts", icon: ImageIcon },
  { label: "SEO Studio", to: "/seo-studio", icon: Search },
  { label: "Media Studio", to: "/media-studio", icon: Clapperboard },
  { label: "Video Studio", to: "/video-studio", icon: MonitorPlay },
  { label: "Movie Composer", to: "/movie-composer", icon: Clapperboard },
  { label: "AI Director", to: "/director", icon: Clapperboard },
  { label: "Cinematic Quality", to: "/cinematic-quality", icon: Sparkles },
  { label: "OCR", to: "/ocr", icon: ScanText },
  { label: "Translate", to: "/translate", icon: Languages },
  { label: "Orchestrator", to: "/orchestrator", icon: Workflow },
  { label: "Assets", to: "/assets", icon: Boxes },
  { label: "Asset Library", to: "/asset-library", icon: BookMarked },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Timeline", to: "/timeline", icon: Activity },
  { label: "Queue", to: "/queue", icon: ListChecks },
  { label: "Job Manager", to: "/jobs", icon: ListChecks },
  { label: "History", to: "/history", icon: History },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Credits", to: "/credits", icon: Coins },
  { label: "Search", to: "/search", icon: Search },
  { label: "Export", to: "/export", icon: Download },
  { label: "Import", to: "/import", icon: Upload },
  { label: "Templates", to: "/templates", icon: LayoutTemplate },
  { label: "AI Agents", to: "/ai-agents", icon: Bot },
] as const;

const footerItems = [
  { label: "Production", to: "/production", icon: Server },
  { label: "Monitoring", to: "/monitoring", icon: Gauge },
  { label: "System Health", to: "/system-health", icon: ShieldCheck },
  { label: "Error Log", to: "/error-log", icon: AlertTriangle },
  { label: "Feature Flags", to: "/feature-flags", icon: Flag },
  { label: "AI Providers", to: "/ai-providers", icon: Cpu },
  { label: "Admin Billing", to: "/admin-billing", icon: BarChart3 },
  { label: "Owner Analytics", to: "/owner-analytics", icon: BarChart3 },
  { label: "Admin Users", to: "/admin-users", icon: Users },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Help", to: "/help", icon: HelpCircle },
] as const;

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const advancedActive = advancedItems.some(
    (i) => pathname === i.to || pathname.startsWith(i.to + "/"),
  );
  const [advancedOpen, setAdvancedOpen] = useState(advancedActive);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-glow">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-bold text-sidebar-foreground">StorySpark</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">AI Studio</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed((c) => !c)}
          className="hidden h-7 w-7 rounded-lg md:inline-flex"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                collapsed && "justify-center px-2",
                active
                  ? "gradient-primary text-white shadow-glow"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        <div className="pt-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            title={collapsed ? "Advanced Tools" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-2",
            )}
            aria-expanded={advancedOpen}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !advancedOpen && "-rotate-90")}
            />
            {!collapsed && <span>Advanced Tools</span>}
          </button>
          {advancedOpen && (
            <div className="mt-1 space-y-1">
              {advancedItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all",
                      collapsed && "justify-center px-2",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        {footerItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                collapsed && "justify-center px-2",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
              )}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
