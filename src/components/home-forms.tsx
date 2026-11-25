"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { createCampaignAction, joinCampaignAction } from "@/app/actions/campaigns";
import type { FormState } from "@/lib/form";
import { SubmitButton } from "./submit-button";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const signup = mode === "signup";
  const v = state.values ?? {};

  return (
    <form key={state.at} action={action} className="panel flex flex-col gap-4">
      <input type="hidden" name="mode" value={mode} />
      <h2 className="font-display text-xl font-bold">{signup ? "Crea il tuo account" : "Accedi"}</h2>
      <label className="flex flex-col gap-1.5">
        <span className="label">Nome utente</span>
        <input
          name="username"
          required
          defaultValue={v.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="field"
          placeholder="es. giulia"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={signup ? "new-password" : "current-password"}
          className="field"
        />
      </label>
      {signup && (
        <label className="flex flex-col gap-1.5">
          <span className="label">Come ti chiamano al tavolo</span>
          <input name="name" defaultValue={v.name} autoComplete="nickname" className="field" placeholder="Es. Giulia" />
        </label>
      )}
      <SubmitButton>{signup ? "Crea account" : "Entra"}</SubmitButton>
      {state.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
      <button type="button" className="btn-ghost self-start text-sm" onClick={() => setMode(signup ? "signin" : "signup")}>
        {signup ? "Hai già un account? Accedi" : "Prima volta? Crea un account"}
      </button>
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

/** Per chi gioca a un tavolo che non usa l'app: scheda, diario e memoria del proprio PG, da solo. */
export function CreatePersonalCampaignForm() {
  const [state, action] = useActionState<FormState, FormData>(createCampaignAction, {});
  return (
    <form action={action} className="panel flex flex-col gap-3 sm:col-span-2">
      <input type="hidden" name="personal" value="1" />
      <h2 className="font-display text-xl font-bold">Gioco per conto mio</h2>
      <p className="text-sm text-muted">
        Il tuo tavolo non usa l&apos;app? Tieni lo stesso scheda, diario e memoria del tuo PG. Se più avanti il gruppo vuole
        unirsi, potrai aprire la campagna.
      </p>
      <input
        name="name"
        required
        className="field"
        placeholder="Nome della campagna"
        aria-label="Nome della tua campagna personale"
      />
      <SubmitButton>Crea la mia campagna</SubmitButton>
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
