import { runSeed } from "../src/lib/seed";
import { prisma } from "../src/lib/prisma";

runSeed()
  .then((result) => {
    console.log(`Admin: ${result.admin} / senha: barberpro123`);
    console.log("Seed concluído: barbeiros Marcos e Arthur, serviços e horários de trabalho criados.");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
