import type { NextRequest } from "next/server";
import { exportCampaignMarkdown } from "@/lib/data/export";

/** Scarica la campagna (quello che l'utente può vedere) come file Markdown. */
export async function GET(_: NextRequest, { params }: RouteContext<"/c/[id]/esporta">) {
  const { id } = await params;
  const { filename, markdown } = await exportCampaignMarkdown(id);
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
