"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/data/types";

export function CampaignNav({ campaignId, role }: { campaignId: string; role: Role }) {
  const pathname = usePathname();
  const base = `/c/${campaignId}`;
  const tabs = [
    { href: base, label: "Diario", exact: true },
    { href: `${base}/cronologia`, label: "Cronologia" },
    { href: `${base}/compendio`, label: "Compendio" },
    { href: `${base}/fili`, label: "Fili e obiettivi" },
    { href: `${base}/frasi`, label: "Frasi" },
    { href: `${base}/cassa`, label: "Inventario PG" },
    { href: `${base}/libro`, label: "📖 Libro" },
    { href: `${base}/scheda`, label: role === "gm" ? "Giocatori" : "Scheda PG" },
    { href: `${base}/cerca`, label: "🔍 Cerca" },
  ];

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Sezioni della campagna">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 font-bold transition ${
              active ? "bg-ink text-bg" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
