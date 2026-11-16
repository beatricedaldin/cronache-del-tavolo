"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import type { FormState } from "@/lib/form";
import { SubmitButton } from "./submit-button";

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form key={state.ok ? state.at : undefined} action={action} className="panel flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold">Cambia password</h2>
      {[
        { name: "current", label: "Password attuale", auto: "current-password" },
        { name: "next", label: "Nuova password (almeno 6 caratteri)", auto: "new-password" },
        { name: "confirm", label: "Ripeti la nuova password", auto: "new-password" },
      ].map((f) => (
        <label key={f.name} className="flex flex-col gap-1.5">
          <span className="label">{f.label}</span>
          <input name={f.name} type="password" required minLength={f.name === "current" ? 1 : 6} autoComplete={f.auto} className="field" />
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Cambia password</SubmitButton>
        {state.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
        {state.ok && <span className="text-sm font-bold text-place">{state.message}</span>}
      </div>
    </form>
  );
}
