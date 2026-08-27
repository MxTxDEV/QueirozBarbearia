import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-black/[0.06]", className)}>
      <div
        className={cn("h-full rounded-full bg-gradient-to-r from-secondary to-secondary-light transition-all", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
