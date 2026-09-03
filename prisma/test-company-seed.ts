import { runTestCompanySeed } from "../src/lib/test-company-seed";
import { prisma } from "../src/lib/prisma";

runTestCompanySeed()
  .then((result) => {
    console.log("Empresa de teste criada/atualizada:");
    console.table({ company: result.company, admin: result.admin, barbers: result.barbers });
    if (result.credentials) {
      console.log(`Contas criadas: ${result.credentials.emails.join(", ")} / senha: ${result.credentials.password}`);
      console.log("IMPORTANTE: guarde essa senha agora — senhas geradas aleatoriamente não são reexibidas depois.");
    } else {
      console.log("Empresa de teste já existia — senhas não alteradas.");
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
