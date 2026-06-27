import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Sparkles, Trash2, Zap } from "lucide-react";
import { getQwenStatus, testQwenConnection } from "@/lib/qwen.functions";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — StorySpark AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
  }, [profile]);

  const statusQuery = useQuery({
    queryKey: ["qwen-status"],
    queryFn: () => getQwenStatus(),
  });
  const testMutation = useMutation({
    mutationFn: () => testQwenConnection(),
    onSuccess: (res) => {
      if (res.ok) toast.success("Qwen connection verified");
      else toast.error(res.error || "Connection failed");
    },
  });
  const connected = statusQuery.data?.connected;
  const verified = testMutation.data?.ok;

  const profileMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: displayName || null, avatar_url: avatarUrl || null });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast.success("Profile updated");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const pwMut = useMutation({
    mutationFn: async () => {
      if (pw.length < 6) throw new Error("Password must be at least 6 characters");
      if (pw !== pw2) throw new Error("Passwords do not match");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => {
      setPw(""); setPw2("");
      toast.success("Password updated");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      // Cascade-delete the user's own data, then sign out. (Full auth user removal requires service-role server function.)
      const { error: pErr } = await supabase.from("projects").delete().eq("user_id", user.id);
      if (pErr) throw pErr;
      await supabase.from("profiles").delete().eq("id", user.id);
      await signOut();
    },
    onSuccess: () => {
      toast.success("Account data deleted");
      navigate({ to: "/login" });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const initials = (displayName || user?.email || "U").trim().slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Manage your profile, preferences and notifications." />

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Qwen AI Integration</h3>
          </div>
          {connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Qwen Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" /> Not connected
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Your Qwen API key is stored securely as a Lovable Cloud secret (<code className="rounded bg-muted px-1.5 py-0.5 text-xs">QWEN_API_KEY</code>) and is never exposed to the browser. To update or rotate it, use the secret manager.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="rounded-xl"
            disabled={!connected || testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing…</>
            ) : (
              "Test connection"
            )}
          </Button>
          {verified && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Ping reply: {testMutation.data?.reply}</span>
          )}
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">Profile</h3>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || "Profile"} />}
            <AvatarFallback className="gradient-primary text-lg font-bold text-white">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled className="rounded-xl" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Avatar URL</Label>
              <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className="rounded-xl" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={profileMut.isPending} onClick={() => profileMut.mutate()} className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            {profileMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">Change password</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm password</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={pwMut.isPending || !pw} onClick={() => pwMut.mutate()} className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            {pwMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
          </Button>
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">Appearance</h3>
        <Row label="Dark mode" description="Easier on the eyes during late-night writing.">
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </Row>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">Credits</h3>
        <Row label="Credits remaining" description="Used across Qwen story, voice and image calls.">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <Zap className="h-3.5 w-3.5" /> Unlimited (dev)
          </span>
        </Row>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">Notifications</h3>
        <Row label="Project updates" description="Get notified when renders, voiceovers and songs are ready.">
          <Switch checked={notifs} onCheckedChange={setNotifs} />
        </Row>
        <div className="my-3 h-px bg-border" />
        <Row label="Marketing emails" description="Occasional updates about new features and templates.">
          <Switch checked={marketing} onCheckedChange={setMarketing} />
        </Row>
      </Card>

      <Card className="glass rounded-3xl border-destructive/40 p-6 shadow-soft">
        <h3 className="mb-2 font-semibold text-destructive">Danger zone</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently delete your profile and all generated projects. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="rounded-xl">
              <Trash2 className="mr-2 h-4 w-4" /> Delete account data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account data?</AlertDialogTitle>
              <AlertDialogDescription>
                All projects, characters and generated content will be permanently removed and you will be signed out.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteMut.mutate()}
              >
                Delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}

function Row({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
