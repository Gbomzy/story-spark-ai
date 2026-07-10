import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand
      duration={4200}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:backdrop-blur group-[.toaster]:animate-fade-in",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:border-emerald-500/40",
          error: "group-[.toaster]:border-destructive/50",
          warning: "group-[.toaster]:border-amber-500/40",
          info: "group-[.toaster]:border-sky-500/40",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
