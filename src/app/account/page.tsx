import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { PasswordForm } from "@/components/password-form";
import { InstallHint } from "@/components/pwa";
import { aiAvailable } from "@/lib/ai";
import { getAiUsage } from "@/lib/data/ai";

export const metadata: Metadata = { title: "Il tuo account" };

export default function AccountPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <Link href="/" className="label hover:text-accent">
        ← Le tue campagne
      </Link>
      <Suspense fallback={<p className="text-muted">Carico…</p>}>
        <Who />
      </Suspense>
      <PasswordForm />
      <InstallHint persistent />
      {aiAvailable() && (
        <Suspense fallback={null}>
          <AiUsage />
        </Suspense>
      )}
    </main>
  );
}

async function Who() {
  const user = await getCurrentUser();
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{user.displayName}</h1>
      <p className="text-muted">
        Nome utente: <code className="font-mono">{user.username}</code>
      </p>
    </div>
  );
}

async function AiUsage() {
  const { used, limit } = await getAiUsage();
  const left = Math.max(0, limit - used);
  return (
    <section className="panel flex flex-col gap-2">
      <h2 className="font-display text-xl font-bold">✨ Richieste AI di oggi</h2>
      <div className="h-2 overflow-hidden rounded-full bg-panel-2" aria-hidden>
        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
      </div>
      <p className="text-sm text-muted">
        Ne hai usate <b className="text-ink">{used}</b> su {limit}: {left === 0 ? "per oggi sono finite, domani si ricomincia." : `te ne restano ${left}.`} Riassunti,
        capitoli, prosa, tag suggeriti e «Cosa so di…?» valgono una richiesta ciascuno.
      </p>
    </section>
  );
}
