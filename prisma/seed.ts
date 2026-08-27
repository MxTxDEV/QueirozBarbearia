import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("barberpro123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@barberpro.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@barberpro.com",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin: ${admin.email} / senha: barberpro123`);

  const marcosUser = await prisma.user.upsert({
    where: { email: "marcos@barberpro.com" },
    update: {},
    create: {
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
      userId: arthurUser.id,
      name: "Arthur",
      specialties: ["Sobrancelha", "Barba desenhada", "Corte moderno"],
      active: true,
    },
  });

  // Segunda a sábado, 09:00–19:00, intervalo de almoço 12:00–13:00
  for (const barber of [marcos, arthur]) {
    for (let weekday = 1; weekday <= 6; weekday++) {
      await prisma.barberWorkingHour.upsert({
        where: { barberId_weekday: { barberId: barber.id, weekday } },
        update: {},
        create: {
          barberId: barber.id,
          weekday,
          startTime: "09:00",
          endTime: "19:00",
          breakStart: "12:00",
          breakEnd: "13:00",
        },
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
    const service = await prisma.service.upsert({
      where: { id: s.name.toLowerCase().replace(/\s+/g, "-").replace(/\+/g, "e") },
      update: {},
      create: { id: s.name.toLowerCase().replace(/\s+/g, "-").replace(/\+/g, "e"), ...s },
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
    where: { key: "system_name" },
    update: {},
    create: { key: "system_name", value: "Barber Pro" },
  });

  await prisma.systemSetting.upsert({
    where: { key: "shop_whatsapp" },
    update: {},
    create: { key: "shop_whatsapp", value: "+5531995797674" },
  });

  console.log("Seed concluído: barbeiros Marcos e Arthur, serviços e horários de trabalho criados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
