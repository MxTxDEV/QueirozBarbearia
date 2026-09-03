import Link from "next/link";
import { Frown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center p-4">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <Frown className="h-10 w-10 text-foreground-muted" />
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-foreground">Página não encontrada</h1>
            <p className="text-sm text-foreground-muted">O endereço que você acessou não existe ou foi movido.</p>
          </div>
          <Link href="/">
            <Button>Voltar ao início</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
