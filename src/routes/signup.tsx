import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { GoogleButton } from "@/components/google-button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — StorySpark AI" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  function set<K extends keyof typeof form>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { display_name: form.name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created! Let's spark some stories.");
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start turning ideas into educational videos in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <GoogleButton label="Sign up with Google" />
        <div className="relative my-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={form.name} onChange={set("name")} placeholder="Ada Lovelace" className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={8} value={form.password} onChange={set("password")} className="rounded-xl" />
          <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
        </div>

        <Button type="submit" disabled={loading} className="w-full rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</> : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
