import { NextResponse, type NextRequest } from "next/server";
import { exchangeAuthCode } from "@/lib/data/auth";

/** Qui arriva il link d'accesso ricevuto via email. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    try {
      await exchangeAuthCode(code);
      return NextResponse.redirect(`${origin}${safeNext}`);
    } catch {
      // Link scaduto o già usato: si torna al login.
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
