import { randomBytes } from "crypto";

/**
 * Resolve a senha inicial de uma conta criada pelo seed: usa a variável de
 * ambiente informada quando definida, ou gera uma senha aleatória segura.
 * Nunca mais um valor fixo no código-fonte — quem popular um ambiente novo
 * recebe a senha gerada de volta (resposta da rota de seed ou saída do CLI)
 * e deve guardá-la, já que ela não é reexibida depois.
 */
export function resolveSeedPassword(envVar: string): { password: string; generated: boolean } {
  const fromEnv = process.env[envVar]?.trim();
  if (fromEnv) return { password: fromEnv, generated: false };
  return { password: randomBytes(9).toString("base64url"), generated: true };
}
