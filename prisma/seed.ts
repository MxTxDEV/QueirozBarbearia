import { runSeed } from "../src/lib/seed";
import { prisma } from "../src/lib/prisma";

runSeed()
  .then((result) => {
    if (result.credentials.superAdmin) {
      console.log(`Super Admin criado: ${result.credentials.superAdmin.email} / senha: ${result.credentials.superAdmin.password}`);
    } else {
      console.log("Super Admin já existia — senha não alterada.");
    }
    if (result.credentials.companyAccounts) {
      console.log(
        `Empresa demo (${result.company}) — contas criadas: ${result.credentials.companyAccounts.emails.join(", ")} / senha: ${result.credentials.companyAccounts.password}`
      );
    } else {
      console.log(`Empresa demo (${result.company}) já existia — senhas não alteradas.`);
    }
    console.log("Seed concluído.");
    console.log("IMPORTANTE: guarde as senhas acima agora — senhas geradas aleatoriamente não são reexibidas depois.");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
