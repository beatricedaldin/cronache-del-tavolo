import type { NextRequest } from "next/server";
import { getBook } from "@/lib/data/ai";
import { getCampaign } from "@/lib/data/campaigns";

/** Scarica il Libro della Campagna (i capitoli già scritti) come file Markdown. */
export async function GET(_: NextRequest, { params }: RouteContext<"/c/[id]/libro/esporta">) {
  const { id } = await params;
  const [campaign, book] = await Promise.all([getCampaign(id), getBook(id)]);
  const lines = [`# ${campaign.name}`, "", "_Il Libro della Campagna_", ""];
  for (const c of book.chapters) lines.push(`## Capitolo ${c.sessionNumber} — ${c.title}`, "", c.content.trim(), "");
  if (book.chapters.length === 0) lines.push("_Nessun capitolo ancora scritto._");
  const slug = campaign.name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="libro-${slug || "campagna"}.md"`,
      "Cache-Control": "private, no-store",
    },
  });
}
