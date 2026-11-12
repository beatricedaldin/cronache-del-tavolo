import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-lg flex-col items-start gap-4 px-4 py-16">
      <p className="label">Strada senza uscita</p>
      <h1 className="font-display text-3xl font-bold">Qui non c&apos;è niente</h1>
      <p className="text-muted">La pagina non esiste, oppure non hai il permesso di vederla (magari è una nota privata di qualcun altro).</p>
      <Link href="/" className="btn">
        Torna alle campagne
      </Link>
    </main>
  );
}
