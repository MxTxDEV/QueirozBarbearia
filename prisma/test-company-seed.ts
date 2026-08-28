import { runTestCompanySeed } from "../src/lib/test-company-seed";
import { prisma } from "../src/lib/prisma";

runTestCompanySeed()
  .then((result) => {
    console.log("Empresa de teste criada/atualizada:");
    console.table(result);
    console.log("Login admin: teste@barberpro.com / senha: barberpro123");
    console.log("Barbeiros: diego@barberpro.com, rafael@barberpro.com, vinicius@barberpro.com / senha: barberpro123");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
