"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/app/actions";

/**
 * Un pulsante che esegue una modifica (eliminare, spuntare…), con conferma facoltativa.
 * Se il database rifiuta, il messaggio compare accanto al pulsante invece di rompere la pagina.
 */
export function ConfirmForm({
  action,
  confirmMessage,
  className,
  label,
  title,
  children,
}: {
  action: (prev: FormState) => Promise<FormState>;
  confirmMessage?: string;
  className?: string;
  label?: string;
  title?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form
      action={formAction}
      className="flex items-center gap-2"
      onSubmit={(e) => {
        if (confirmMessage && !confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <button type="submit" className={className} aria-label={label} title={title} disabled={pending}>
        {children}
      </button>
      {state.error && (
        <span role="alert" className="text-xs font-bold text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
