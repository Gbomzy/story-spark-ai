import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Film, Search, MoreVertical, Pencil, Copy, Trash2, FolderOpen, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteProject, duplicateProject, listProjects, updateProject, type ProjectRow } from "@/lib/projects";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({ meta: [{ title: "Projects — StorySpark AI" }] }),
  component: ProjectsPage,
});

const colorFor = (i: number) => ["gradient-primary", "gradient-warm", "gradient-cool"][i % 3];

function ProjectsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/projects") return <Outlet />;

  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "alpha">("newest");
  const [renameTarget, setRenameTarget] = useState<ProjectRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? projects.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.topic ?? "").toLowerCase().includes(q) ||
            (p.objective ?? "").toLowerCase().includes(q),
        )
      : [...projects];
    list.sort((a, b) => {
      if (sort === "alpha") return a.name.localeCompare(b.name);
      const da = new Date(a.updated_at).getTime();
      const db = new Date(b.updated_at).getTime();
      return sort === "newest" ? db - da : da - db;
    });
    return list;
  }, [projects, query, sort]);

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateProject(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project renamed");
      setRenameTarget(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Rename failed"),
  });

  const dupMut = useMutation({
    mutationFn: (id: string) => duplicateProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project duplicated");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Duplicate failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      setDeleteTarget(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Every story, voiceover and storyboard you're working on."
        actions={
          <Button asChild className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            <Link to="/projects/new"><Plus className="mr-2 h-4 w-4" /> New project</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="rounded-xl pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-full rounded-xl sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="alpha">A → Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading projects…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass grid place-items-center rounded-3xl p-16 text-center shadow-soft">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white shadow-glow">
            <FolderOpen className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold">No projects yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {query ? "Try a different search term." : "Spin up your first educational video story in a few minutes."}
          </p>
          {!query && (
            <Button asChild className="mt-5 rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
              <Link to="/projects/new"><Plus className="mr-2 h-4 w-4" /> Create your first project</Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <Card key={p.id} className="glass overflow-hidden rounded-3xl p-0 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
              <button
                type="button"
                onClick={() => navigate({ to: "/projects/$id", params: { id: p.id } })}
                className={`relative block h-32 w-full ${colorFor(i)}`}
                aria-label={`Open ${p.name}`}
              >
                <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,white,transparent_60%)]" />
                </div>
                <Film className="absolute bottom-3 right-3 h-6 w-6 text-white/80" />
              </button>
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to="/projects/$id"
                      params={{ id: p.id }}
                      className="block truncate font-semibold leading-tight hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{p.topic || "Untitled topic"}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 rounded-lg" aria-label="Project actions">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => navigate({ to: "/projects/$id", params: { id: p.id } })}>
                        <FolderOpen className="mr-2 h-4 w-4" /> Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setRenameTarget(p); setRenameValue(p.name); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => dupMut.mutate(p.id)}>
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleteTarget(p)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {p.age_group && <Badge variant="secondary" className="rounded-full">Ages {p.age_group}</Badge>}
                  {p.duration && <Badge variant="secondary" className="rounded-full">{p.duration} min</Badge>}
                  {p.style && <Badge variant="secondary" className="rounded-full">{p.style}</Badge>}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                  <Button asChild size="sm" variant="ghost" className="rounded-lg">
                    <Link to="/projects/$id" params={{ id: p.id }}>Open</Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename project</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename">New name</Label>
            <Input id="rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button
              disabled={!renameValue.trim() || renameMut.isPending}
              onClick={() => renameTarget && renameMut.mutate({ id: renameTarget.id, name: renameValue.trim() })}
              className="rounded-xl gradient-primary text-white"
            >
              {renameMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" and all of its generated content will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && delMut.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
