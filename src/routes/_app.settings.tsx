import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — StorySpark AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [notifs, setNotifs] = useState(true);
  const [marketing, setMarketing] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Manage your profile, preferences and notifications." />

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
