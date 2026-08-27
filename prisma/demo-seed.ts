import { runDemoSeed, removeDemoData } from "../src/lib/demo-seed";
import { prisma } from "../src/lib/prisma";

/**
 * Popula (ou remove) os dados de demonstração.
 *   pnpm db:seed:demo          -> cria cortes, clientes e atendimentos
 *   pnpm db:seed:demo --remove -> apaga tudo que foi criado por ele
 */
const remove = process.argv.includes("--remove");

(remove ? removeDemoData() : runDemoSeed())
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
