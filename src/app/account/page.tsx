import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/data/auth";
import { PasswordForm } from "@/components/password-form";
import { InstallHint } from "@/components/pwa";

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
