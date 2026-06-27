import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";
import { getQwenStatus, testQwenConnection } from "@/lib/qwen.functions";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — StorySpark AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [notifs, setNotifs] = useState(true);
  const [marketing, setMarketing] = useState(false);

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
            <AvatarFallback className="gradient-primary text-lg font-bold text-white">AS</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input defaultValue="Alex Storyteller" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input defaultValue="alex@storyspark.ai" className="rounded-xl" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => toast.success("Profile saved")} className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">Save</Button>
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">Appearance</h3>
        <Row label="Dark mode" description="Easier on the eyes during late-night writing.">
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
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
