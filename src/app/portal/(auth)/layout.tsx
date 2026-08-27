import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function PortalAuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
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
