import Link from "next/link";
import { Suspense } from "react";
import { getCampaign } from "@/lib/data/campaigns";
import { listEntities } from "@/lib/data/compendium";

export default function CompendiumPage({ params }: PageProps<"/c/[id]/compendio">) {
  return (
    <Suspense fallback={<p className="text-muted">Sfoglio il compendio…</p>}>
      <Compendium params={params} />
    </Suspense>
  );
}

async function Compendium({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [campaign, entities] = await Promise.all([getCampaign(id), listEntities(id)]);
  const isGm = campaign.role === "gm";

  if (entities.length === 0) {
    return (
      <p className="panel text-muted">
        Il compendio si riempie da solo: scrivi nel diario <code className="font-mono">@Nome</code> o{" "}
        <code className="font-mono">#Luogo</code> e qui comparirà una pagina per ciascuno.
      </p>
    );
  }

  const groups = [
    { kind: "npc" as const, title: "Personaggi" },
    { kind: "place" as const, title: "Luoghi e fazioni" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => {
        const items = entities.filter((e) => e.kind === g.kind);
        if (items.length === 0) return null;
        return (
          <section key={g.kind} className="flex flex-col gap-3">
            <h2 className={`label ${g.kind === "npc" ? "text-npc" : "text-place"}`}>
              {g.title} · {items.length}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((e) => (
                <li key={e.slug}>
                  <Link
                    href={`/c/${id}/compendio/${e.kind}/${e.slug}`}
                    className="panel flex h-full flex-col gap-2 transition hover:border-accent"
                  >
                    <span className="font-display text-xl font-bold">{e.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      <span className="session">
                        S{e.firstSession}
                        {e.lastSession !== e.firstSession && `–S${e.lastSession}`}
                      </span>
                      {e.mentions} {e.mentions === 1 ? "nota" : "note"}
                      {isGm && ` · ${e.authors} ${e.authors === 1 ? "giocatore" : "giocatori"}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
