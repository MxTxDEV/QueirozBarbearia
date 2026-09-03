"use client";

// Só entra em ação se o próprio Root Layout (src/app/layout.tsx) quebrar —
// nesse caso substitui a árvore inteira, por isso precisa das próprias
// tags <html>/<body>. Erros normais de página são tratados por error.tsx.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>Algo deu errado</h1>
          <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
            Ocorreu um erro inesperado ao carregar a aplicação.
          </p>
          <button
            onClick={() => reset()}
            style={{ padding: "0.5rem 1.25rem", borderRadius: "0.75rem", background: "#111", color: "#fff", border: "none", cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
