"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { toggleSuperAdminActiveAction, resetSuperAdminPasswordAction } from "@/actions/superadmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SuperAdminRowActions({ userId, active, isSelf }: { userId: string; active: boolean; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");
  const [savingPassword, startPasswordTransition] = useTransition();

  function toggleActive() {
    if (active && !confirm("Bloquear o login desta conta Super Admin? Ela não vai mais conseguir entrar na plataforma.")) return;
    startTransition(async () => {
      const result = await toggleSuperAdminActiveAction(userId, !active);
      if (result.ok) {
        toast.success(active ? "Super Admin bloqueado." : "Super Admin ativado.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function savePassword() {
    if (password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    const formData = new FormData();
    formData.set("password", password);
    startPasswordTransition(async () => {
      const result = await resetSuperAdminPasswordAction(userId, undefined, formData);
      if (result.ok) {
        toast.success("Senha atualizada.");
        setResetting(false);
        setPassword("");
      } else {
        toast.error(result.error);
      }
    });
  }

  if (resetting) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Input
          type="password"
          placeholder="Nova senha"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-8 w-36"
          autoFocus
        />
        <Button size="sm" disabled={savingPassword} onClick={savePassword}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setResetting(false); setPassword(""); }}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" variant="ghost" onClick={() => setResetting(true)}>
        <KeyRound className="h-3.5 w-3.5" /> Trocar senha
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending || (active && isSelf)}
        title={active && isSelf ? "Você não pode bloquear sua própria conta." : undefined}
        onClick={toggleActive}
      >
        {active ? "Bloquear" : "Ativar"}
      </Button>
    </div>
  );
}
