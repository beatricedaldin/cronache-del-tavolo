import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "./errors";

/** I bucket di Supabase Storage. Chi può leggere e scrivere lo decidono le policy in 0004_condivisione.sql. */
export type Bucket = "compendio" | "ritratti";

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 4 * 1024 * 1024;
/** I link firmati durano un giorno: abbastanza per una serata al tavolo. */
const URL_TTL = 60 * 60 * 24;

/** Controlla il file e restituisce l'estensione da usare. */
export function checkImage(file: unknown): { file: File; ext: string } {
  if (!(file instanceof File) || file.size === 0) throw new Error("Scegli un'immagine.");
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Formato non supportato: usa JPG, PNG, WebP o GIF.");
  if (file.size > MAX_BYTES) throw new Error("L'immagine è troppo grande (massimo 4 MB).");
  return { file, ext };
}

export async function uploadImage(bucket: Bucket, path: string, file: File) {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw dbError({ message: error.message });
}

export async function removeImage(bucket: Bucket, path: string | null) {
  if (!path) return;
  const supabase = await createClient();
  // Se il file non c'è più va bene lo stesso.
  await supabase.storage.from(bucket).remove([path]);
}

/** Link temporanei per mostrare le immagini private. I percorsi che l'utente non può leggere restano senza link. */
export async function signedUrls(bucket: Bucket, paths: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const out = new Map<string, string>();
  if (wanted.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(wanted, URL_TTL);
  for (const d of data ?? []) if (d.path && d.signedUrl && !d.error) out.set(d.path, d.signedUrl);
  return out;
}

/** Un nome di file difficile da indovinare. */
export const randomName = (ext: string) => `${crypto.randomUUID()}.${ext}`;
