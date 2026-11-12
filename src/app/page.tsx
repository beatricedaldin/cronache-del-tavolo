import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "./actions";
import { getCurrentUser } from "@/lib/data/auth";
import { listMyCampaigns } from "@/lib/data/campaigns";
import { CreateCampaignForm, JoinCampaignForm } from "@/components/home-forms";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="label">Fabula Ultima</p>
          <h1 className="font-display text-4xl font-bold">Cronache del Tavolo</h1>
        </div>
        <Suspense fallback={null}>
          <Account />
        </Suspense>
      </header>

      <Suspense fallback={<p className="text-muted">Carico le tue campagne…</p>}>
        <Campaigns />
      </Suspense>

      <section className="grid gap-4 sm:grid-cols-2">
        <JoinCampaignForm />
        <CreateCampaignForm />
      </section>
    </main>
  );
}

async function Account() {
  const user = await getCurrentUser();
  return (
    <form action={signOutAction} className="flex items-center gap-3 text-sm text-muted">
      <span>
        Ciao, <b className="text-ink">{user.displayName}</b>
      </span>
      <button type="submit" className="btn-ghost">
        Esci
      </button>
    </form>
  );
}

async function Campaigns() {
  const campaigns = await listMyCampaigns();
  if (campaigns.length === 0) {
    return (
      <p className="panel text-muted">
        Non fai ancora parte di nessuna campagna. Entra con il codice del Master, oppure creane una.
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label">Le tue campagne</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {campaigns.map((c) => (
          <li key={c.id}>
            <Link href={`/c/${c.id}`} className="panel flex flex-col gap-1 transition hover:border-accent">
              <span className={`label ${c.role === "gm" ? "text-gold" : ""}`}>
                {c.role === "gm" ? "Master" : "Giocatore"}
              </span>
              <span className="font-display text-2xl font-bold">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
