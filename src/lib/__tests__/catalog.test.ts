import { describe, expect, it } from "vitest";
import { CATALOG_CLASSES, FABULA_CATALOG } from "../fabula-catalog";

describe("catalogo dei manuali", () => {
  it("ha id univoci", () => {
    const ids = FABULA_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("ogni voce ha nome, fonte e pagina valida", () => {
    for (const e of FABULA_CATALOG) {
      expect(e.name.trim(), e.id).not.toBe("");
      expect(e.source.trim(), e.id).not.toBe("");
      expect(Number.isInteger(e.page) && e.page > 0, `${e.id} pagina`).toBe(true);
    }
  });
  it("le Classi richieste esistono nell'elenco delle Classi del catalogo", () => {
    const known = new Set<string>(CATALOG_CLASSES.map((c) => (typeof c === "string" ? c : (c as { name: string }).name)));
    for (const e of FABULA_CATALOG) {
      for (const required of e.requiredClasses) expect(known.has(required), `${e.id} → ${required}`).toBe(true);
    }
  });
  it("i gradi massimi sono ragionevoli", () => {
    for (const e of FABULA_CATALOG) if (e.maxRank !== undefined) expect(e.maxRank).toBeGreaterThanOrEqual(1);
  });
});
