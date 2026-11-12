/** Legenda della sintassi del diario: sempre visibile accanto a dove si scrive. */
export function SyntaxLegend({ className = "" }: { className?: string }) {
  const rows = [
    { code: "@Velia", result: <span className="rounded-md bg-npc-bg px-1.5 font-bold text-npc">Velia</span>, text: "personaggio" },
    { code: "@[Mastro Odo]", result: <span className="rounded-md bg-npc-bg px-1.5 font-bold text-npc">Mastro Odo</span>, text: "nome di più parole" },
    { code: "#Portocielo", result: <span className="rounded-md bg-place-bg px-1.5 font-bold text-place">⌖ Portocielo</span>, text: "luogo o fazione" },
    { code: "#[Culto del Sole]", result: <span className="rounded-md bg-place-bg px-1.5 font-bold text-place">⌖ Culto del Sole</span>, text: "luogo di più parole" },
    { code: "? Chi è stato?", result: <span className="rounded-md bg-thread-bg px-1.5 font-bold text-thread">? Chi è stato?</span>, text: "a inizio riga: filo in sospeso" },
    { code: "! Trovare la bussola", result: <span className="rounded-md bg-goal-bg px-1.5 font-bold text-goal">! Trovare la bussola</span>, text: "a inizio riga: obiettivo" },
  ];
  return (
    <section className={`panel flex flex-col gap-2 ${className}`} aria-label="Legenda della sintassi">
      <h2 className="label">Come si scrive</h2>
      <dl className="flex flex-col gap-2 text-sm">
        {rows.map((r) => (
          <div key={r.code} className="flex flex-col gap-0.5">
            <dt className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-panel-2 px-1.5 font-mono text-xs">{r.code}</code>
              <span aria-hidden>→</span>
              {r.result}
            </dt>
            <dd className="text-xs text-muted">{r.text}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-line pt-2 text-xs text-muted">
        Fili e obiettivi restano privati anche nelle voci pubbliche: li vedete solo tu e il Master.
      </p>
    </section>
  );
}
