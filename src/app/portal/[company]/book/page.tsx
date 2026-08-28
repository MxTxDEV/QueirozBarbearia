import { requireCompleteCustomerProfile } from "@/lib/require-customer";
import { listActiveBarbersWithServices } from "@/lib/data/barbers";
import { toNumber } from "@/lib/serialize";
import { BookingWizard } from "./booking-wizard";

export default async function BookPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const customer = await requireCompleteCustomerProfile(slug);
  const barbers = await listActiveBarbersWithServices(customer.companyId);

  const data = barbers.map((b) => ({
    id: b.id,
    name: b.name,
    photoUrl: b.photoUrl,
    specialties: b.specialties,
    services: b.services.map((bs) => ({
      id: bs.service.id,
      name: bs.service.name,
      price: toNumber(bs.service.price),
      durationMinutes: bs.service.durationMinutes,
    })),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Agendar horário</h1>
        <p className="text-sm text-foreground-muted">Escolha o barbeiro, os serviços e o melhor horário para você.</p>
      </div>
      <BookingWizard barbers={data} companySlug={slug} />
    </div>
  );
}
