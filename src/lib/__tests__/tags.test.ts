import { describe, expect, it } from "vitest";
import { extractGoals, extractTags, extractThreads, slugify, tokenize } from "../tags";

describe("slugify", () => {
  it("toglie accenti e punteggiatura", () => {
    expect(slugify("Mastro Odo")).toBe("mastro-odo");
    expect(slugify("Città della Luce!")).toBe("citta-della-luce");
    expect(slugify("  --  ")).toBe("");
  });
});

describe("tag del diario", () => {
  it("riconosce @personaggi e #luoghi, anche con più parole", () => {
    const tags = extractTags("Ho visto @Velia e @[Mastro Odo] a #Portocielo, nel #[Culto del Sole].");
    expect(tags.map((t) => `${t.kind}:${t.slug}`)).toEqual([
      "npc:velia",
      "npc:mastro-odo",
      "place:portocielo",
      "place:culto-del-sole",
    ]);
  });
  it("separa il CamelCase", () => {
    expect(extractTags("#CultoDelSole")[0].name).toBe("Culto Del Sole");
  });
  it("non confonde email o parole attaccate con tag", () => {
    expect(extractTags("scrivi a mario@example.com")).toEqual([]);
  });
  it("conta una sola volta lo stesso tag", () => {
    expect(extractTags("@Velia @velia @Velia")).toHaveLength(1);
  });
  it("tokenize conserva il testo intorno ai tag", () => {
    const parts = tokenize("ciao @Velia!");
    expect(parts.map((p) => p.type)).toEqual(["text", "tag", "text"]);
  });
});

describe("fili e obiettivi", () => {
  const body = "Testo\n? Chi ha rubato la bussola?\n! Ritrovare la bussola\n?\n? Chi ha rubato la bussola?";
  it("estrae le righe con ? senza duplicati né righe vuote", () => {
    expect(extractThreads(body)).toEqual(["Chi ha rubato la bussola?"]);
  });
  it("estrae le righe con !", () => {
    expect(extractGoals(body)).toEqual(["Ritrovare la bussola"]);
  });
  it("taglia a 300 caratteri", () => {
    expect(extractThreads(`? ${"a".repeat(400)}`)[0]).toHaveLength(300);
  });
});
