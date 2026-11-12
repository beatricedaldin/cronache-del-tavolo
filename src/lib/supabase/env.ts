export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Manca NEXT_PUBLIC_SUPABASE_URL in .env.local");
  return url;
}

export function supabaseKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Manca NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  return key;
}
