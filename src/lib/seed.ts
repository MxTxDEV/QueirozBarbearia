import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SUPERADMIN_EMAIL = "admin@barberpro.com";
const SUPERADMIN_PASSWORD = "barberpro123@";

/** Cria o usuário SUPERADMIN da plataforma (idempotente). companyId sempre nulo. */
export async function ensureSuperAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: SUPERADMIN_EMAIL } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
  return prisma.user.create({
    data: {
      name: "Super Admin",
      email: SUPERADMIN_EMAIL,
      passwordHash,
      role: "SUPERADMIN",
      companyId: null,
    },
  });
}

/**
 * Popula os dados iniciais do sistema (idempotente via upsert): o SUPERADMIN
 * da plataforma e a empresa de demonstração "Queiroz Barbearia" (admin,
 * barbeiros Marcos e Arthur, horários de trabalho e catálogo de serviços).
 * Usado pelo script `db:seed` e pela rota `/api/system/seed` — útil em
 * ambientes onde não é possível rodar `prisma db seed` diretamente contra o
 * banco de produção (ex: conexão só via HTTPS).
 */
export async function runSeed() {
  await ensureSuperAdmin();

  const company = await prisma.company.upsert({
    where: { slug: "queiroz-barbearia" },
    update: {},
    create: {
      id: "company_default",
      name: "Queiroz Barbearia",
      tradeName: "Queiroz Barbearia",
      slug: "queiroz-barbearia",
      whatsapp: "+5531995797674",
      logoUrl: "/logo-queiroz-transparent.png",
    },
  });

  const passwordHash = await bcrypt.hash("barberpro123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "queiroz@barberpro.com" },
    update: {},
    create: {
      companyId: company.id,
      name: "Administrador",
      email: "queiroz@barberpro.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const marcosUser = await prisma.user.upsert({
    where: { email: "marcos@barberpro.com" },
    update: {},
    create: {
      companyId: company.id,
      name: "Marcos",
      email: "marcos@barberpro.com",
      passwordHash,
      role: "BARBER",
    },
  });

  const arthurUser = await prisma.user.upsert({
    where: { email: "arthur@barberpro.com" },
    update: {},
    create: {
      companyId: company.id,
      name: "Arthur",
      email: "arthur@barberpro.com",
      passwordHash,
      role: "BARBER",
    },
  });

  const marcos = await prisma.barber.upsert({
    where: { userId: marcosUser.id },
    update: {},
    create: {
      companyId: company.id,
      userId: marcosUser.id,
      name: "Marcos",
      specialties: ["Corte clássico", "Barba", "Degradê"],
      active: true,
    },
  });

  const arthur = await prisma.barber.upsert({
    where: { userId: arthurUser.id },
    update: {},
    create: {
      companyId: company.id,
      userId: arthurUser.id,
      name: "Arthur",
      specialties: ["Sobrancelha", "Barba desenhada", "Corte moderno"],
      active: true,
    },
  });

  for (const barber of [marcos, arthur]) {
    for (let weekday = 1; weekday <= 6; weekday++) {
      await prisma.barberWorkingHour.upsert({
        where: { barberId_weekday: { barberId: barber.id, weekday } },
        update: {},
        create: { barberId: barber.id, weekday, startTime: "09:00", endTime: "19:00", breakStart: "12:00", breakEnd: "13:00" },
      });
    }
  }

  const servicesData = [
    { name: "Corte", description: "Corte de cabelo tradicional", price: 45, durationMinutes: 40 },
    { name: "Barba", description: "Modelagem completa de barba", price: 35, durationMinutes: 30 },
    { name: "Sobrancelha", description: "Design de sobrancelha na navalha", price: 20, durationMinutes: 10 },
    { name: "Corte + Barba", description: "Combo corte e barba", price: 70, durationMinutes: 70 },
  ];

  const services = [];
  for (const s of servicesData) {
    const id = `${company.id}-${s.name.toLowerCase().replace(/\s+/g, "-").replace(/\+/g, "e")}`;
    const service = await prisma.service.upsert({
      where: { id },
      update: {},
      create: { id, companyId: company.id, ...s },
    });
    services.push(service);
  }

  for (const barber of [marcos, arthur]) {
    for (const service of services) {
      await prisma.barberService.upsert({
        where: { barberId_serviceId: { barberId: barber.id, serviceId: service.id } },
        update: {},
        create: { barberId: barber.id, serviceId: service.id },
      });
    }
  }

  await prisma.systemSetting.upsert({
    where: { companyId_key: { companyId: company.id, key: "system_name" } },
    update: {},
    create: { companyId: company.id, key: "system_name", value: company.name },
  });

  await prisma.systemSetting.upsert({
    where: { companyId_key: { companyId: company.id, key: "shop_whatsapp" } },
    update: {},
    create: { companyId: company.id, key: "shop_whatsapp", value: "+5531995797674" },
  });

  return { admin: admin.email, company: company.slug };
}
