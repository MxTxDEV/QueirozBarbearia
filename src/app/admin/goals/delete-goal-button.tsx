"use client";

import { deleteGoalAction } from "@/actions/goals";
import { SubmitButton } from "@/components/ui/submit-button";

export function DeleteGoalButton({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  return (
    <form
      action={deleteGoalAction.bind(null, goalId)}
      onSubmit={(e) => {
        if (!confirm(`Remover a meta "${goalTitle}"? Essa ação não pode ser desfeita.`)) {
          e.preventDefault();
        }
      }}
    >
      <SubmitButton pendingText="Removendo..." size="sm" variant="ghost">
        Remover meta
      </SubmitButton>
    </form>
  );
}
