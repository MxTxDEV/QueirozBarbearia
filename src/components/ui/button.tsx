import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-secondary-light to-secondary text-white shadow-[0_4px_20px_rgba(14,165,233,0.35)] hover:brightness-110 active:brightness-95",
        accent:
          "bg-gradient-to-b from-accent-light to-accent text-white shadow-[0_4px_20px_rgba(29,78,216,0.3)] hover:brightness-110",
        secondary:
          "glass glass-hover text-foreground border-glass",
        outline:
          "border bg-transparent text-foreground hover:bg-[var(--surface-subtle-hover)]",
        ghost: "text-foreground-muted hover:bg-[var(--surface-subtle-hover)] hover:text-foreground",
        destructive: "bg-danger text-white hover:brightness-110",
        link: "text-secondary-light underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
