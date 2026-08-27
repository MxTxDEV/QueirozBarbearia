import Link from "next/link";
import { Scissors } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-secondary-light to-secondary-dark text-white shadow-[0_4px_20px_rgba(200,30,44,0.35)]">
            <Scissors className="h-5 w-5" />
          </span>
          <Link href="/" className="text-xl font-semibold text-foreground">
            Barber<span className="text-secondary-light">Pro</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
