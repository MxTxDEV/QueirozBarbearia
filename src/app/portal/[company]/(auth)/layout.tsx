import Link from "next/link";
import { resolvePortalCompany } from "@/lib/require-customer";
import { CompanyLogo } from "@/components/company-logo";

export default async function PortalAuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ company: string }>;
}) {
  const { company: slug } = await params;
  const company = await resolvePortalCompany(slug);

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <Link href="/">
            <CompanyLogo logoUrl={company.logoUrl} name={company.name} height={40} />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
