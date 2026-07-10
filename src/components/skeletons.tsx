import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      role="status"
      aria-hidden="true"
    >
      <span className="skeleton-shimmer-overlay" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div
      className="glass rounded-3xl p-6 shadow-soft space-y-4"
      role="status"
      aria-label="Loading content"
    >
      <Skeleton className="h-5 w-1/3" />
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Loading list">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4"
        >
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center", className)}>
      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="grid min-h-[40vh] place-items-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{label}…</p>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div
      className="glass mx-auto max-w-xl rounded-3xl p-8 sm:p-10 text-center shadow-soft animate-fade-in"
      role="region"
    >
      {icon && (
        <div
          className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white shadow-glow"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="text-lg sm:text-xl font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}