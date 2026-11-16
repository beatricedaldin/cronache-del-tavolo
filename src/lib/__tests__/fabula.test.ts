import { describe, expect, it } from "vitest";
import {
  bondStrength,
  characterCreationErrors,
  characterLevel,
  classesLabel,
  derive,
  emptySheet,
  isStartingDistribution,
  normalizeEmotions,
  normalizeSheet,
  RULES,
  sheetWarnings,
  type Sheet,
} from "../fabula";

const cls = (name: string, level: number, hp = 0, mp = 0, ip = 0) => ({ name, level, hp, mp, ip });

function sheetWith(patch: Partial<Sheet>): Sheet {
  return { ...emptySheet(), ...patch };
}

describe("distribuzioni iniziali", () => {
  it("accetta le tre distribuzioni in qualsiasi ordine", () => {
    expect(isStartingDistribution({ dex: 8, ins: 8, mig: 8, wlp: 8 })).toBe(true);
    expect(isStartingDistribution({ dex: 6, ins: 10, mig: 8, wlp: 8 })).toBe(true);
    expect(isStartingDistribution({ dex: 6, ins: 6, mig: 10, wlp: 10 })).toBe(true);
  });
  it("rifiuta le altre", () => {
    expect(isStartingDistribution({ dex: 12, ins: 8, mig: 8, wlp: 6 })).toBe(false);
    expect(isStartingDistribution({ dex: 10, ins: 10, mig: 10, wlp: 6 })).toBe(false);
  });
});

describe("livello e valori derivati", () => {
  it("il livello è la somma dei livelli di classe, con tetto a 50", () => {
    expect(characterLevel(sheetWith({ classes: [cls("Furia", 3), cls("Guardiano", 2)] }), 5)).toBe(5);
    expect(characterLevel(sheetWith({ classes: [cls("A", 10), cls("B", 10), cls("C", 10), cls("D", 10), cls("E", 10), cls("F", 10)] }), 5)).toBe(50);
  });
  it("senza classi usa il valore di riserva", () => {
    expect(characterLevel(emptySheet(), 7)).toBe(7);
  });
  it("calcola PV, PM, PI e soglia di crisi", () => {
    const sheet = sheetWith({
      attributes: { dex: 8, ins: 8, mig: 10, wlp: 6 },
      classes: [cls("Furia", 3, 5, 0, 1), cls("Guardiano", 2, 0, 5, 0)],
    });
    const d = derive(sheet, 5);
    expect(d.level).toBe(5);
    expect(d.maxHp).toBe(10 * 5 + 5 + 5);
    expect(d.crisis).toBe(30);
    expect(d.maxMp).toBe(6 * 5 + 5 + 5);
    expect(d.maxIp).toBe(RULES.baseInventoryPoints + 1);
  });
  it("Difesa: DES di base oppure armatura marziale, più i bonus dell'equipaggiamento", () => {
    const gear = { name: "Scudo", slot: "scudo", defense: 2, magicDefense: 1, initiative: -1 } as unknown as Sheet["equipment"][number];
    const plain = derive(sheetWith({ equipment: [gear] }), 5);
    expect(plain.defense).toBe(8 + 2);
    expect(plain.magicDefense).toBe(8 + 1);
    expect(plain.initiative).toBe(-1);
    const armored = derive(sheetWith({ defenseBase: 10, equipment: [gear] }), 5);
    expect(armored.defense).toBe(12);
  });
});

describe("creazione guidata", () => {
  const valid = () =>
    sheetWith({ classes: [cls("Furia", 3), cls("Guardiano", 2)], attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 } });

  it("una scheda corretta non ha errori", () => {
    expect(characterCreationErrors(valid())).toEqual([]);
  });
  it("richiede 2 o 3 classi diverse e 5 livelli", () => {
    expect(characterCreationErrors(sheetWith({ ...valid(), classes: [cls("Furia", 5)] }))).toContain("Scegli due o tre Classi.");
    expect(characterCreationErrors(sheetWith({ ...valid(), classes: [cls("Furia", 3), cls("furia", 2)] }))).toContain("Ogni Classe deve essere diversa.");
    expect(characterCreationErrors(sheetWith({ ...valid(), classes: [cls("Furia", 3), cls("Guardiano", 3)] })).join(" ")).toContain("esattamente 5 livelli");
  });
  it("controlla il budget di equipaggiamento", () => {
    const equipment = [{ cost: 400 }, { cost: 200 }] as unknown as Sheet["equipment"];
    expect(characterCreationErrors({ ...valid(), equipment }).join(" ")).toContain("budget iniziale è 500");
  });
});

describe("Legami", () => {
  it("la forza è una per emozione, massimo 3", () => {
    expect(bondStrength(["Affetto"])).toBe(1);
    expect(bondStrength(["Affetto", "Lealtà", "Ammirazione", "x"])).toBe(3);
  });
  it("tiene una sola emozione per coppia, nell'ordine delle coppie", () => {
    expect(normalizeEmotions(["Odio", "Affetto", "Lealtà"])).toEqual(["Lealtà", "Affetto"]);
    expect(normalizeEmotions(["Inventata"])).toEqual([]);
  });
});

describe("avvisi", () => {
  it("segnala Abilità Eroiche in eccesso e classi aperte in eccesso", () => {
    const sheet = sheetWith({
      classes: [cls("A", 3), cls("B", 3), cls("C", 3), cls("D", 3)],
      skills: [{ heroic: true }] as unknown as Sheet["skills"],
    });
    const warnings = sheetWarnings(sheet, 0).join(" ");
    expect(warnings).toContain("Abilità Eroiche");
    expect(warnings).toContain("4 classi non padroneggiate");
  });
  it("segnala troppi Legami", () => {
    expect(sheetWarnings(emptySheet(), RULES.maxBonds + 1)).toHaveLength(1);
    expect(sheetWarnings(emptySheet(), RULES.maxBonds)).toEqual([]);
  });
});

describe("normalizeSheet", () => {
  it("regge input spazzatura senza lanciare", () => {
    for (const input of [null, undefined, 42, "x", [], {}, { classes: "no", skills: 3, attributes: null }]) {
      expect(() => normalizeSheet(input)).not.toThrow();
    }
  });
  it("riporta i dadi non validi a un valore ammesso e limita i livelli", () => {
    const sheet = normalizeSheet({ attributes: { dex: 99, ins: "x", mig: 10, wlp: 6 }, classes: [{ name: "Furia", level: 99 }, { name: "" }] });
    expect([6, 8, 10, 12]).toContain(sheet.attributes.dex);
    expect([6, 8, 10, 12]).toContain(sheet.attributes.ins);
    expect(sheet.classes).toHaveLength(1);
    expect(sheet.classes[0].level).toBeLessThanOrEqual(RULES.maxClassLevel);
  });
  it("è idempotente", () => {
    const once = normalizeSheet({ classes: [{ name: "Furia", level: 3, hp: 5 }], zenit: 120 });
    expect(normalizeSheet(once)).toEqual(once);
  });
  it("classesLabel mostra nome e livello", () => {
    expect(classesLabel(sheetWith({ classes: [cls("Furia", 3), cls("Guardiano", 2)] }))).toBe("Furia 3 · Guardiano 2");
  });
});
