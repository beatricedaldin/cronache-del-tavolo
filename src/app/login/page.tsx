import type { Metadata } from "next";
import { LoginForm } from "@/components/home-forms";
import { InstallHint } from "@/components/pwa";

export const metadata: Metadata = { title: "Accedi" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <p className="label">Fabula Ultima</p>
        <h1 className="font-display text-4xl font-bold">Cronache del Tavolo</h1>
        <p className="mt-2 text-muted">Schede, diario e memoria condivisa della vostra campagna.</p>
      </div>
      <LoginForm />
      <InstallHint />
    </main>
  );
}
