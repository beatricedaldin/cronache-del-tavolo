"use server";

import { redirect } from "next/navigation";
import { changePassword, normalizeUsername, signInWithPassword, signOut, signUpWithPassword, USERNAME_PATTERN } from "@/lib/data/auth";
import { errorMessage, str, type FormState } from "@/lib/form";

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const mode = str(fd, "mode") === "signup" ? "signup" : "signin";
  const username = normalizeUsername(str(fd, "username"));
  const password = String(fd.get("password") ?? "");
  const name = str(fd, "name");
  const at = Date.now();
  const keep = { username, name, mode };

  if (!USERNAME_PATTERN.test(username)) {
    return {
      error: "Il nome utente va da 3 a 30 caratteri: lettere minuscole, numeri, punto, trattino o trattino basso.",
      values: keep,
      at,
    };
  }
  if (password.length < 6) return { error: "La password deve avere almeno 6 caratteri.", values: keep, at };

  try {
    if (mode === "signup") await signUpWithPassword(username, password, name || undefined);
    else await signInWithPassword(username, password);
  } catch (e) {
    return { error: errorMessage(e), values: keep, at };
  }
  redirect("/");
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const at = Date.now();
  if (next.length < 6) return { error: "La nuova password deve avere almeno 6 caratteri.", at };
  if (next !== confirm) return { error: "Le due nuove password non coincidono.", at };
  try {
    await changePassword(current, next);
  } catch (e) {
    return { error: errorMessage(e), at };
  }
  return { ok: true, message: "Password cambiata.", at };
}
