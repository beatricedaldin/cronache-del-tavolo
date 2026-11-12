"use client";

import { useActionState } from "react";
import { createCampaignAction, joinCampaignAction, loginAction, type FormState } from "@/app/actions";
import { SubmitButton } from "./submit-button";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});
  if (state.ok) return <p className="panel font-bold">{state.message}</p>;

  return (
    <form action={action} className="panel flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="label">Email</span>
        <input name="email" type="email" required autoComplete="email" className="field" placeholder="tu@esempio.it" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">Come ti chiamano al tavolo (solo al primo accesso)</span>
        <input name="name" type="text" autoComplete="nickname" className="field" placeholder="Es. Giulia" />
      </label>
      <SubmitButton>Mandami il link d&apos;accesso</SubmitButton>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
      <p className="text-sm text-muted">Niente password: ricevi un link via email e sei dentro.</p>
    </form>
  );
}

export function CreateCampaignForm() {
  const [state, action] = useActionState<FormState, FormData>(createCampaignAction, {});
  return (
    <form action={action} className="panel flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold">Sono il Master</h2>
      <p className="text-sm text-muted">Crea la campagna e condividi il codice invito con il gruppo.</p>
      <input name="name" required className="field" placeholder="Nome della campagna" aria-label="Nome della campagna" />
      <SubmitButton>Crea campagna</SubmitButton>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}

export function JoinCampaignForm() {
  const [state, action] = useActionState<FormState, FormData>(joinCampaignAction, {});
  return (
    <form action={action} className="panel flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold">Sono un giocatore</h2>
      <p className="text-sm text-muted">Inserisci il codice che ti ha dato il Master.</p>
      <input
        name="code"
        required
        className="field font-mono uppercase tracking-widest"
        placeholder="A1B2C3D4"
        aria-label="Codice invito"
        autoCapitalize="characters"
      />
      <SubmitButton>Entra nella campagna</SubmitButton>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
    </form>
  );
}
