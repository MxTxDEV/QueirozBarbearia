import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-secondary/30 bg-[var(--badge-secondary-bg)] text-secondary-light",
        accent: "border-accent/30 bg-[var(--badge-accent-bg)] text-accent-light",
        success: "border-success/30 bg-[var(--badge-success-bg)] text-success",
        warning: "border-warning/30 bg-[var(--badge-warning-bg)] text-warning",
        danger: "border-danger/30 bg-[var(--badge-danger-bg)] text-danger",
        outline: "border text-foreground-muted",
        muted: "border-transparent bg-[var(--surface-subtle)] text-foreground-muted",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
