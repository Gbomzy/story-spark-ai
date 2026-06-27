import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Moon, Sun, Search, Menu, LogOut, User, CreditCard, Settings as SettingsIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const notifications = [
  { id: 1, title: "Your story 'Lila & the Star' rendered successfully", time: "2m ago" },
  { id: 2, title: "Voiceover ready for 'Tiny Astronauts'", time: "1h ago" },
  { id: 3, title: "New template added: Bedtime Adventures", time: "Yesterday" },
];

export function TopBar() {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Storyteller";
  const initials = (profile?.display_name || user?.email || "U")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "U";

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search projects, characters, templates…" className="rounded-xl pl-9" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/settings"
          className="hidden items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-semibold shadow-soft transition hover:bg-card sm:inline-flex"
          title="Credits remaining"
        >
          <span className="grid h-5 w-5 place-items-center rounded-md gradient-primary text-white">
            <Zap className="h-3 w-3" />
          </span>
          <span className="tabular-nums">8,420</span>
          <span className="text-muted-foreground">credits</span>
        </Link>

        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="rounded-xl">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative rounded-xl">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold">Notifications</div>
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className="px-4 py-3 text-sm">
                  <p className="font-medium leading-snug">{n.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{n.time}</p>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-muted">
              <Avatar className="h-8 w-8">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <AvatarFallback className="gradient-primary text-xs font-bold text-white">{initials}</AvatarFallback>
                )}
              </Avatar>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[140px]">{user?.email}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings"><User className="mr-2 h-4 w-4" />Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings"><SettingsIcon className="mr-2 h-4 w-4" />Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CreditCard className="mr-2 h-4 w-4" />Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
