import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <Link href="/">
            <BrandLogo height={40} />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
