import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Youtube, Music2, Instagram, Facebook, Twitter, Linkedin, Plug, PlugZap, RefreshCw, Send, Loader2, CheckCircle2, XCircle, Clock, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listProjects } from "@/lib/projects";
import {
  PLATFORMS,
  type Platform,
  type PublishConnection,
  type PublishHistoryRow,
  listPublishConnections,
  connectPlatform,
  disconnectPlatform,
  listPublishHistory,
  publishPost,
  retryPublish,
} from "@/lib/publishing.functions";

export const Route = createFileRoute("/_app/publishing")({
  head: () => ({ meta: [{ title: "Publishing Center — StorySpark AI" }] }),
  component: PublishingPage,
});

const PLATFORM_META: Record<Platform, { label: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  youtube: { label: "YouTube", icon: Youtube, hint: "Google OAuth · MP4 + thumbnail + description" },
  facebook: { label: "Facebook Pages", icon: Facebook, hint: "Page access token · MP4 posts" },
  instagram: { label: "Instagram Business", icon: Instagram, hint: "Graph API · Reels / feed video" },
  tiktok: { label: "TikTok", icon: Music2, hint: "Content Posting API · 9:16 MP4" },
  linkedin: { label: "LinkedIn", icon: Linkedin, hint: "UGC Posts · MP4 + article copy" },
  x: { label: "X (Twitter)", icon: Twitter, hint: "v2 Media · MP4 + caption" },
};

function PublishingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Publishing Center"
        description="Connect your social accounts and publish finished movies to every major platform."
      />
      <ConnectionsGrid />
      <PublishComposer />
      <HistoryTable />
    </div>
  );
}

function useConnections() {
  const fetcher = useServerFn(listPublishConnections);
  return useQuery({ queryKey: ["publish-connections"], queryFn: () => fetcher(), refetchInterval: 15000 });
}

function ConnectionsGrid() {
  const qc = useQueryClient();
  const { data: connections } = useConnections();
  const [dialogFor, setDialogFor] = useState<Platform | null>(null);
  const connect = useServerFn(connectPlatform);
  const disconnect = useServerFn(disconnectPlatform);

  const connectMut = useMutation({
    mutationFn: (v: { platform: Platform; account_name: string }) => connect({ data: v }),
    onSuccess: () => { toast.success("Account connected."); qc.invalidateQueries({ queryKey: ["publish-connections"] }); setDialogFor(null); },
    onError: (e: Error) => toast.error(e.message || "Connect failed."),
  });
  const disconnectMut = useMutation({
    mutationFn: (p: Platform) => disconnect({ data: { platform: p } }),
    onSuccess: () => { toast.success("Disconnected."); qc.invalidateQueries({ queryKey: ["publish-connections"] }); },
    onError: (e: Error) => toast.error(e.message || "Disconnect failed."),
  });

  const byPlatform = new Map<Platform, PublishConnection>();
  (connections ?? []).forEach((c) => byPlatform.set(c.platform, c));

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Account connections</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const meta = PLATFORM_META[p];
          const conn = byPlatform.get(p);
          const connected = conn?.status === "connected";
          const Icon = meta.icon;
          return (
            <Card key={p} className="glass rounded-3xl p-5 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary shadow-glow">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{meta.label}</h3>
                    <p className="text-xs text-muted-foreground">{meta.hint}</p>
                  </div>
                </div>
                <Badge variant={connected ? "default" : "secondary"}>{conn?.status ?? "disconnected"}</Badge>
              </div>
              {connected && conn?.account_name ? (
                <p className="mb-2 text-xs text-muted-foreground">Account · <span className="font-medium">{conn.account_name}</span></p>
              ) : (
                <p className="mb-2 text-xs text-muted-foreground">Platform connection required.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {connected ? (
                  <>
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setDialogFor(p)}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reconnect
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-lg text-destructive"
                      onClick={() => disconnectMut.mutate(p)} disabled={disconnectMut.isPending}>
                      {disconnectMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plug className="mr-1.5 h-3.5 w-3.5" />}
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="rounded-lg gradient-primary text-white shadow-glow" onClick={() => setDialogFor(p)}>
                    <PlugZap className="mr-1.5 h-3.5 w-3.5" /> Connect
                  </Button>
                )}
              </div>
              {dialogFor === p ? (
                <ConnectForm
                  platform={p}
                  onCancel={() => setDialogFor(null)}
                  onSubmit={(account_name) => connectMut.mutate({ platform: p, account_name })}
                  pending={connectMut.isPending}
                />
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ConnectForm({ platform, onCancel, onSubmit, pending }: { platform: Platform; onCancel: () => void; onSubmit: (name: string) => void; pending: boolean }) {
  const [name, setName] = useState("");
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-card/60 p-3">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {PLATFORM_META[platform].label} account handle or page name
      </Label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="@my-channel" />
      <p className="text-[10px] text-muted-foreground">
        Access tokens are stored securely on the server. This form registers the account; complete OAuth on the provider before first publish.
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="rounded-lg gradient-primary text-white" disabled={pending || !name.trim()} onClick={() => onSubmit(name.trim())}>
          {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Save
        </Button>
      </div>
    </div>
  );
}

function PublishComposer() {
  const qc = useQueryClient();
  const { data: connections } = useConnections();
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const publish = useServerFn(publishPost);

  const [platform, setPlatform] = useState<Platform>("youtube");
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [scheduledAt, setScheduledAt] = useState<string>("");

  const connected = useMemo(() => new Set((connections ?? []).filter((c) => c.status === "connected").map((c) => c.platform)), [connections]);
  const isConnected = connected.has(platform);

  const mut = useMutation({
    mutationFn: () =>
      publish({
        data: {
          platform,
          projectId: projectId || undefined,
          title,
          description: description || undefined,
          tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
          hashtags: hashtags ? hashtags.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean) : undefined,
          thumbnailUrl: thumbnailUrl || undefined,
          videoUrl: videoUrl || undefined,
          visibility,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(scheduledAt ? "Post scheduled." : "Publish queued.");
      qc.invalidateQueries({ queryKey: ["publish-history"] });
      setTitle(""); setDescription(""); setTags(""); setHashtags(""); setThumbnailUrl(""); setVideoUrl(""); setScheduledAt("");
    },
    onError: (e: Error) => toast.error(e.message || "Publish failed."),
  });

  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Publish</h2>
          <p className="text-xs text-muted-foreground">Compose the post and send it to the selected platform.</p>
        </div>
        <Badge variant={isConnected ? "default" : "secondary"}>{isConnected ? "Ready" : "Platform connection required."}</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>{PLATFORM_META[p].label}{connected.has(p) ? "" : " · not connected"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Optional — link a project" /></SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Description / caption" />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ai, storytelling, animation" />
          </div>
          <div>
            <Label>Hashtags</Label>
            <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#shorts #ai" />
          </div>
          <div>
            <Label>Video URL</Label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…/movie.mp4" />
          </div>
          <div>
            <Label>Thumbnail URL</Label>
            <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://…/cover.jpg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Schedule</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          className="rounded-xl gradient-primary text-white shadow-glow"
          disabled={!isConnected || !title.trim() || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          {scheduledAt ? "Schedule post" : "Publish now"}
        </Button>
      </div>
    </Card>
  );
}

function HistoryTable() {
  const qc = useQueryClient();
  const fetcher = useServerFn(listPublishHistory);
  const { data: rows } = useQuery({ queryKey: ["publish-history"], queryFn: () => fetcher(), refetchInterval: 8000 });
  const retry = useServerFn(retryPublish);
  const retryMut = useMutation({
    mutationFn: (id: string) => retry({ data: { id } }),
    onSuccess: () => { toast.success("Retry queued."); qc.invalidateQueries({ queryKey: ["publish-history"] }); },
    onError: (e: Error) => toast.error(e.message || "Retry failed."),
  });
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Publish history</h2>
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing published yet. Your posts and their status will appear here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Platform</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Post ID</th>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 pr-3">{PLATFORM_META[r.platform]?.label ?? r.platform}</td>
                  <td className="py-2 pr-3">{r.title ?? "—"}</td>
                  <td className="py-2 pr-3"><StatusPill row={r} /></td>
                  <td className="py-2 pr-3 font-mono text-[11px]">{r.external_post_id ?? "—"}</td>
                  <td className="py-2 pr-3 text-[11px] text-muted-foreground">
                    {new Date(r.published_at ?? r.scheduled_at ?? r.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3">
                    {r.status === "failed" ? (
                      <Button size="sm" variant="outline" onClick={() => retryMut.mutate(r.id)} disabled={retryMut.isPending}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StatusPill({ row }: { row: PublishHistoryRow }) {
  const map: Record<PublishHistoryRow["status"], { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
    queued: { label: "Queued", className: "bg-muted text-foreground/70", icon: Clock },
    scheduled: { label: "Scheduled", className: "bg-blue-500/15 text-blue-500", icon: Clock },
    uploading: { label: "Uploading", className: "bg-amber-500/15 text-amber-500", icon: Upload },
    processing: { label: "Processing", className: "bg-amber-500/15 text-amber-500", icon: Loader2 },
    published: { label: "Published", className: "bg-emerald-500/15 text-emerald-500", icon: CheckCircle2 },
    failed: { label: "Failed", className: "bg-red-500/15 text-red-500", icon: XCircle },
  };
  const s = map[row.status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${s.className}`} title={row.error_message ?? undefined}>
      <Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}