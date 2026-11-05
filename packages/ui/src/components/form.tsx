import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/utils";

const control =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 aria-[invalid=true]:border-destructive disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

/** Label + control + hint/error, wired up for accessibility. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string | string[];
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !message && <p className="text-xs text-muted-foreground">{hint}</p>}
      {message && (
        <p id={`${htmlFor}-error`} className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

export function Alert({
  variant = "info",
  className,
  ...props
}: ComponentProps<"div"> & { variant?: "info" | "error" | "success" }) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        variant === "error" && "border-destructive/40 bg-destructive/5 text-destructive",
        variant === "success" && "border-success/40 bg-success/5 text-success",
        variant === "info" && "border-border bg-background",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-border px-1.5 py-0.5 text-xs",
        className,
      )}
      {...props}
    />
  );
}
