import "server-only";
import { prisma } from "@/lib/prisma";
import type { AppointmentStatus, PaymentMethod } from "@prisma/client";

/**
 * Dados de DEMONSTRAÇÃO: catálogo de cortes ampliado, clientes e um
 * histórico de atendimentos com pagamentos — para o sistema ter conteúdo
 * real de exercitar (dashboard, calendário, relatórios, financeiro).
 *
 * Separado de `runSeed` (dados essenciais do sistema) de propósito: aqui é
 * conteúdo descartável. Tudo usa IDs determinísticos com prefixo `demo-`,
 * então rodar duas vezes atualiza em vez de duplicar, e dá para remover
 * tudo depois filtrando por esse prefixo — ver `removeDemoData()`.
 */

const DEMO_PREFIX = "demo-";

/** PRNG com semente fixa: as execuções geram sempre o mesmo conjunto. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SERVICES = [
  { slug: "corte-social", name: "Corte Social", description: "Corte clássico na tesoura e máquina", price: 45, durationMinutes: 40 },
  { slug: "corte-degrade", name: "Corte Degradê", description: "Fade com transição suave nas laterais", price: 55, durationMinutes: 45 },
  { slug: "corte-navalhado", name: "Corte Navalhado", description: "Acabamento e desenho na navalha", price: 60, durationMinutes: 50 },
  { slug: "corte-infantil", name: "Corte Infantil", description: "Corte para crianças até 12 anos", price: 35, durationMinutes: 30 },
  { slug: "corte-tesoura", name: "Corte na Tesoura", description: "Corte todo trabalhado na tesoura", price: 65, durationMinutes: 55 },
  { slug: "pezinho", name: "Pezinho", description: "Acabamento de nuca e costeletas", price: 20, durationMinutes: 15 },
  { slug: "barba-terapia", name: "Barba Terapia", description: "Barba com toalha quente, óleo e massagem", price: 50, durationMinutes: 40 },
  { slug: "combo-completo", name: "Combo Completo", description: "Corte, barba e sobrancelha", price: 95, durationMinutes: 80 },
  { slug: "pigmentacao", name: "Pigmentação", description: "Camuflagem de fios brancos", price: 40, durationMinutes: 30 },
  { slug: "platinado", name: "Platinado", description: "Descoloração e tonalização", price: 150, durationMinutes: 120 },
  { slug: "hidratacao", name: "Hidratação", description: "Tratamento capilar hidratante", price: 45, durationMinutes: 30 },
  { slug: "relaxamento", name: "Relaxamento", description: "Alisamento capilar masculino", price: 80, durationMinutes: 60 },
];

const CUSTOMERS = [
  "João Silva", "Marcos Oliveira", "Pedro Santos", "Carlos Mendes", "Rafael Souza",
  "Lucas Almeida", "Bruno Costa", "Felipe Rocha", "Thiago Barbosa", "Gabriel Lima",
  "Rodrigo Martins", "Vinícius Cardoso", "Matheus Ferreira", "Daniel Ribeiro", "André Gomes",
  "Leonardo Pinto", "Gustavo Araújo", "Eduardo Nunes", "Fernando Dias", "Ricardo Teixeira",
  "Paulo Henrique", "Otávio Moreira", "Samuel Freitas", "Igor Carvalho",
];

const PAYMENT_METHODS: PaymentMethod[] = ["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD"];

function dateOnlyUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function timeOn(day: Date, minutesFromMidnight: number) {
  return new Date(day.getTime() + minutesFromMidnight * 60_000);
}

export async function runDemoSeed(companyId: string) {
  const random = makeRandom(20260827);

  // --- Catálogo de cortes -------------------------------------------------
  const services = [];
  for (const s of SERVICES) {
    const id = `${DEMO_PREFIX}${companyId}-svc-${s.slug}`;
    services.push(
      await prisma.service.upsert({
        where: { id },
        update: { name: s.name, description: s.description, price: s.price, durationMinutes: s.durationMinutes },
        create: { id, companyId, name: s.name, description: s.description, price: s.price, durationMinutes: s.durationMinutes },
      })
    );
  }

  // Habilita todos os serviços para os barbeiros ativos.
  const barbers = await prisma.barber.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } });
  if (barbers.length === 0) {
    throw new Error("Nenhum barbeiro ativo encontrado — rode o seed principal antes do seed de demonstração.");
  }
  for (const barber of barbers) {
    for (const service of services) {
      await prisma.barberService.upsert({
        where: { barberId_serviceId: { barberId: barber.id, serviceId: service.id } },
        update: {},
        create: { barberId: barber.id, serviceId: service.id },
      });
    }
  }

  // --- Clientes -----------------------------------------------------------
  const customers = [];
  for (let i = 0; i < CUSTOMERS.length; i++) {
    const fullName = CUSTOMERS[i];
    const whatsapp = `+55319${String(70000000 + i * 137).padStart(8, "0")}`;
    const [first, last] = fullName.toLowerCase().split(" ");
    customers.push(
      await prisma.customer.upsert({
        where: { companyId_whatsapp: { companyId, whatsapp } },
        update: {},
        create: {
          id: `${DEMO_PREFIX}${companyId}-cus-${String(i).padStart(3, "0")}`,
          companyId,
          fullName,
          whatsapp,
          email: `${first}.${last}@example.com`,
          birthDate: new Date(Date.UTC(1980 + (i % 25), i % 12, ((i * 7) % 27) + 1)),
        },
      })
    );
  }

  // --- Atendimentos -------------------------------------------------------
  // 45 dias para trás (histórico/faturamento) e 10 para frente (agenda).
  const today = dateOnlyUTC(new Date());
  let appointmentSeq = 0;
  let created = 0;

  for (let offset = -45; offset <= 10; offset++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() + offset);
    if (day.getUTCDay() === 0) continue; // domingo: fechado (expediente é seg–sáb)

    for (const barber of barbers) {
      // Começa às 09:00; pula o almoço (12:00–13:00); encerra às 19:00.
      let cursor = 9 * 60;
      const perDay = 3 + Math.floor(random() * 4); // 3 a 6 atendimentos

      for (let n = 0; n < perDay; n++) {
        const service = services[Math.floor(random() * services.length)];
        const duration = service.durationMinutes;

        if (cursor < 13 * 60 && cursor + duration > 12 * 60) cursor = 13 * 60; // almoço
        if (cursor + duration > 19 * 60) break;

        const customer = customers[Math.floor(random() * customers.length)];
        const startTime = timeOn(day, cursor);
        const endTime = timeOn(day, cursor + duration);

        let status: AppointmentStatus;
        if (offset < 0) {
          const roll = random();
          status = roll < 0.86 ? "COMPLETED" : roll < 0.94 ? "CANCELLED" : "NO_SHOW";
        } else if (offset === 0) {
          status = startTime < new Date() ? "COMPLETED" : random() < 0.7 ? "CONFIRMED" : "PENDING";
        } else {
          status = random() < 0.65 ? "CONFIRMED" : "PENDING";
        }

        const id = `${DEMO_PREFIX}${companyId}-apt-${String(appointmentSeq++).padStart(5, "0")}`;
        const price = Number(service.price);

        await prisma.appointment.upsert({
          where: { id },
          update: {},
          create: {
            id,
            companyId,
            customerId: customer.id,
            barberId: barber.id,
            appointmentDate: day,
            startTime,
            endTime,
            totalPrice: price,
            totalDurationMin: duration,
            status,
            completedAt: status === "COMPLETED" ? endTime : null,
            cancelledAt: status === "CANCELLED" ? startTime : null,
            confirmedAt: status === "CONFIRMED" || status === "COMPLETED" ? startTime : null,
            services: {
              create: [
                {
                  serviceId: service.id,
                  serviceName: service.name,
                  priceAtBooking: price,
                  durationAtBooking: duration,
                },
              ],
            },
          },
        });
        created++;

        // Pagamento + lançamento financeiro para atendimentos concluídos.
        if (status === "COMPLETED") {
          const seqSuffix = String(appointmentSeq - 1).padStart(5, "0");
          const paymentId = `${DEMO_PREFIX}${companyId}-pay-${seqSuffix}`;
          const method = PAYMENT_METHODS[Math.floor(random() * PAYMENT_METHODS.length)];
          await prisma.payment.upsert({
            where: { id: paymentId },
            update: {},
            create: {
              id: paymentId,
              companyId,
              appointmentId: id,
              customerId: customer.id,
              amount: price,
              paymentMethod: method,
              paidAt: endTime,
            },
          });
          const ftxId = `${DEMO_PREFIX}${companyId}-ftx-${seqSuffix}`;
          await prisma.financialTransaction.upsert({
            where: { id: ftxId },
            update: {},
            create: {
              id: ftxId,
              companyId,
              type: "INCOME",
              category: "Serviços",
              description: `${service.name} — ${customer.fullName}`,
              amount: price,
              transactionDate: endTime,
              paymentMethod: method,
              appointmentId: id,
              customerId: customer.id,
              status: "PAID",
            },
          });
        }

        cursor += duration + 10; // 10 min de intervalo entre atendimentos
      }
    }
  }

  return { services: services.length, customers: customers.length, appointments: created };
}

/**
 * Remove tudo que `runDemoSeed` criou, identificado pelo prefixo `demo-`.
 * A ordem respeita as foreign keys: primeiro o que aponta para o
 * agendamento, depois o agendamento, e só então serviços e clientes.
 */
export async function removeDemoData(companyId: string) {
  const prefix = `${DEMO_PREFIX}${companyId}-`;
  const demoId = { id: { startsWith: prefix }, companyId };

  const financialTransactions = await prisma.financialTransaction.deleteMany({ where: demoId });
  const payments = await prisma.payment.deleteMany({ where: demoId });
  const appointmentServices = await prisma.appointmentService.deleteMany({
    where: { appointmentId: { startsWith: prefix } },
  });
  const appointments = await prisma.appointment.deleteMany({ where: demoId });
  const barberServices = await prisma.barberService.deleteMany({
    where: { serviceId: { startsWith: prefix } },
  });
  const services = await prisma.service.deleteMany({ where: demoId });
  const customers = await prisma.customer.deleteMany({ where: demoId });

  return {
    financialTransactions: financialTransactions.count,
    payments: payments.count,
    appointmentServices: appointmentServices.count,
    appointments: appointments.count,
    barberServices: barberServices.count,
    services: services.count,
    customers: customers.count,
  };
}
