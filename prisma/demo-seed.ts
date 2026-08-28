import { runDemoSeed, removeDemoData } from "../src/lib/demo-seed";
import { prisma } from "../src/lib/prisma";

/**
 * Popula (ou remove) os dados de demonstração para a empresa mais antiga
 * cadastrada (ambiente local de desenvolvimento costuma ter só uma).
 *   pnpm db:seed:demo          -> cria cortes, clientes e atendimentos
 *   pnpm db:seed:demo --remove -> apaga tudo que foi criado por ele
 */
const remove = process.argv.includes("--remove");

async function main() {
  const company = await prisma.company.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return remove ? removeDemoData(company.id) : runDemoSeed(company.id);
}

main()
  .then((result) => {
    console.log(remove ? "Dados de demonstração removidos:" : "Dados de demonstração criados:");
    console.table(result);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
