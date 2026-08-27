import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border bg-[var(--surface-subtle)] px-3 py-2 text-sm text-foreground shadow-inner backdrop-blur-sm transition-colors placeholder:text-foreground-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 focus-visible:border-secondary/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
