import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "./types";

/**
 * L'accesso è con nome utente + password, senza email.
 * Supabase però vuole un'email: la ricaviamo dal nome utente con un dominio fittizio.
 * Non viene mai inviato nulla, perché in Supabase la conferma email è disattivata.
 */
const USERNAME_DOMAIN = "giocatori.cronache-del-tavolo.local";

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export const normalizeUsername = (username: string) => username.trim().toLowerCase();

const toEmail = (username: string) => `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;

const usernameFromEmail = (email: string) => email.split("@")[0];

/** L'utente collegato. Se non c'è, manda al login. Letto una sola volta per richiesta. */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", claims.sub)
    .maybeSingle();

  const username = typeof claims.email === "string" ? usernameFromEmail(claims.email) : "";
  return { id: claims.sub, username, displayName: profile?.display_name ?? username };
});

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Nome utente o password sbagliati.";
  if (m.includes("already registered") || m.includes("already exists")) return "Questo nome utente è già preso.";
  if (m.includes("password")) return "La password deve avere almeno 6 caratteri.";
  if (m.includes("signups not allowed")) return "Le registrazioni sono chiuse.";
  return message;
}

export async function signInWithPassword(username: string, password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signUpWithPassword(username: string, password: string, displayName?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: toEmail(username),
    password,
    options: { data: { display_name: displayName || normalizeUsername(username) } },
  });
  if (error) throw new Error(translateAuthError(error.message));
  if (!data.session) {
    // Succede solo se in Supabase è ancora attiva la conferma email.
    throw new Error(
      "Account creato, ma Supabase chiede di confermare l'email. Disattiva \"Confirm email\" in Authentication > Sign In / Providers > Email.",
    );
  }
}

/** Cambia la password dell'utente collegato, dopo aver verificato quella attuale. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const check = await supabase.auth.signInWithPassword({ email: toEmail(user.username), password: currentPassword });
  if (check.error) throw new Error("La password attuale non è corretta.");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (/different from the old/i.test(error.message)) throw new Error("La nuova password deve essere diversa da quella attuale.");
    throw new Error(translateAuthError(error.message));
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
