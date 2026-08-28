import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * "glass" (padrão) usa o efeito de vidro translúcido com blur. "solid"
   * usa a mesma linguagem visual (borda, sombra) mas com fundo opaco, sem
   * backdrop-filter — obrigatório para qualquer Card que envolva um
   * elemento com rolagem própria (ex: `<Table>`, que tem overflow-x-auto).
   * `backdrop-filter` sobre um ancestral de um elemento com overflow é um
   * bug conhecido do WebKit/iOS Safari que faz o card inteiro (não só o
   * blur) sumir visualmente no celular.
   */
  variant?: "glass" | "solid";
}

function Card({ className, variant = "glass", ...props }: CardProps) {
  return <div className={cn(variant === "glass" ? "glass glass-hover" : "glass-solid", "rounded-2xl", className)} {...props} />;
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-0", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-medium text-foreground-muted", className)} {...props} />;
}

function CardValue({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-2xl font-semibold tracking-tight text-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardValue, CardContent, CardFooter };
