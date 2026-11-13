import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

/** Client Supabase lato server. Va creato a ogni richiesta, mai riusato. */
export async function createClient() {
  // Tutto quello che passa da Supabase dipende da chi è collegato e dall'ora (scadenza della
  // sessione): va calcolato a ogni richiesta, mai nel guscio pre-renderizzato della pagina.
  await connection();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: i cookie li aggiorna il proxy.
        }
      },
    },
  });
}
