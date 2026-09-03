import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { runDemoSeed } from "@/lib/demo-seed";
import { resolveSeedPassword } from "@/lib/seed-credentials";

/**
 * Cria uma empresa de TESTE completa (idempotente via upsert): admin, 3
 * barbeiros com horário de trabalho definido, e então reaproveita
 * `runDemoSeed` — o mesmo gerador usado para popular uma empresa real com
 * dados de demonstração — para o catálogo de serviços (12 tipos de corte),
 * ~24 clientes e o histórico de atendimentos (45 dias pra trás, 10 pra
 * frente, com pagamentos para os concluídos). Só a criação da empresa e
 * dos barbeiros é específica daqui; o resto é o gerador de demo já testado.
 *
 * Útil para explorar dashboard, calendário, financeiro e relatórios com
 * dados realistas sem mexer na empresa real (Queiroz Barbearia). Usado
 * pelo script `db:seed:test-company` e pela rota `/api/system/seed`
 * (`?mode=test-company`) — a mesma rota HTTP usada para popular produção
 * quando não há acesso a terminal no servidor.
 */
export async function runTestCompanySeed() {
  const company = await prisma.company.upsert({
    where: { slug: "barbearia-teste" },
    update: {},
    create: {
      name: "Barbearia Teste",
      tradeName: "Barbearia Teste",
      slug: "barbearia-teste",
      whatsapp: "+5531999990000",
      status: "ACTIVE",
    },
  });

  const testAdminEmail = "teste@barberpro.com";
  const adminExisted = !!(await prisma.user.findUnique({ where: { email: testAdminEmail }, select: { id: true } }));
  const { password: sharedPassword } = resolveSeedPassword("SEED_TEST_COMPANY_PASSWORD");
  const passwordHash = await bcrypt.hash(sharedPassword, 12);

  await prisma.user.upsert({
    where: { email: testAdminEmail },
    update: {},
    create: {
      companyId: company.id,
      name: "Administrador Teste",
      email: testAdminEmail,
      passwordHash,
      role: "ADMIN",
    },
  });

  const BARBERS_DATA = [
    { slug: "diego", name: "Diego", specialties: ["Degradê", "Barba", "Corte na tesoura"] },
    { slug: "rafael", name: "Rafael", specialties: ["Navalhado", "Pigmentação", "Platinado"] },
    { slug: "vinicius", name: "Vinícius", specialties: ["Corte infantil", "Sobrancelha", "Relaxamento"] },
  ];

  const barbers = [];
  for (const b of BARBERS_DATA) {
    const email = `${b.slug}@barberpro.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { companyId: company.id, name: b.name, email, passwordHash, role: "BARBER" },
    });
    const barber = await prisma.barber.upsert({
      where: { userId: user.id },
      update: {},
      create: { companyId: company.id, userId: user.id, name: b.name, specialties: b.specialties, active: true },
    });
    barbers.push(barber);

    for (let weekday = 1; weekday <= 6; weekday++) {
      await prisma.barberWorkingHour.upsert({
        where: { barberId_weekday: { barberId: barber.id, weekday } },
        update: {},
        create: { barberId: barber.id, weekday, startTime: "09:00", endTime: "19:00", breakStart: "12:00", breakEnd: "13:00" },
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
    create: { companyId: company.id, key: "shop_whatsapp", value: company.whatsapp ?? "" },
  });

  const demo = await runDemoSeed(company.id);

  return {
    company: company.slug,
    admin: testAdminEmail,
    barbers: barbers.length,
    ...demo,
    credentials: !adminExisted
      ? { password: sharedPassword, emails: [testAdminEmail, ...BARBERS_DATA.map((b) => `${b.slug}@barberpro.com`)] }
      : null,
  };
}
