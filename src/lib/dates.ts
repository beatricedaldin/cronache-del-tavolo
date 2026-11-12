/** Date "di calendario" (AAAA-MM-GG), sempre riferite all'Italia per non sbagliare giorno vicino a mezzanotte. */

const TZ = "Europe/Rome";

/** Oggi in Italia, come AAAA-MM-GG. Uguale su server e browser. */
export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

/** "12 nov 2026" da "2026-11-12". */
export function formatDay(iso: string, month: "short" | "long" = "short") {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("it-IT", { day: "numeric", month, year: "numeric", timeZone: "UTC" });
}
