/**
 * Regole di Fabula Ultima usate dall'app: forma della scheda, valori derivati, avvisi.
 * È l'unico file da toccare se un numero va corretto.
 * Le regole di fine sessione (PE, salita di livello) non ci sono di proposito:
 * le decide il Master.
 */

// ---------------------------------------------------------------------------
// Costanti di regolamento
// ---------------------------------------------------------------------------

export const DICE = [6, 8, 10, 12] as const;
export type Die = (typeof DICE)[number];

export const ATTRIBUTES = [
  { key: "dex", short: "DES", name: "Destrezza" },
  { key: "ins", short: "INT", name: "Intuito" },
  { key: "mig", short: "VIG", name: "Vigore" },
  { key: "wlp", short: "VOL", name: "Volontà" },
] as const;
export type AttributeKey = (typeof ATTRIBUTES)[number]["key"];

/** Le tre distribuzioni iniziali delle caratteristiche: si assegnano i dadi liberamente. Si parte al massimo da d10. */
export const STARTING_DISTRIBUTIONS: Die[][] = [
  [8, 8, 8, 8],
  [10, 8, 8, 6],
  [10, 10, 6, 6],
];

export const RULES = {
  startingLevel: 5,
  maxLevel: 50,
  maxClassLevel: 10,
  /** Punti Inventario di base, prima dei bonus di classe. */
  baseInventoryPoints: 6,
  startingFabulaPoints: 3,
  maxBonds: 6,
  /** Budget per l'equipaggiamento alla creazione. Gli Zenit avanzati si sommano a 2d6 × 10. */
  equipmentBudget: 500,
  /** Classi non padroneggiate (sotto il livello 10) che si possono avere insieme. */
  maxOpenClasses: 3,
} as const;

/** Le coppie di emozioni dei Legami: se ne può scegliere al massimo una per coppia. */
export const EMOTION_PAIRS = [
  ["Ammirazione", "Inferiorità"],
  ["Lealtà", "Sfiducia"],
  ["Affetto", "Odio"],
] as const;

export const EQUIPMENT_SLOTS = [
  { key: "arma", label: "Arma" },
  { key: "armatura", label: "Armatura" },
  { key: "scudo", label: "Scudo" },
  { key: "accessorio", label: "Accessorio" },
  { key: "altro", label: "Altro" },
] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number]["key"];

/** Promemoria brevi da consultare al tavolo. */
export const STATUSES = [
  { name: "Confuso", effect: "INT −1 dado" },
  { name: "Furente", effect: "DES e INT −1 dado" },
  { name: "Avvelenato", effect: "VIG e VOL −1 dado" },
  { name: "Scosso", effect: "VOL −1 dado" },
  { name: "Lento", effect: "DES −1 dado" },
  { name: "Debole", effect: "VIG −1 dado" },
] as const;

export const FABULA_USES = [
  "Invocare un Tratto: ritiri uno o entrambi i dadi.",
  "Invocare un Legame: aggiungi la sua forza al risultato.",
  "Cambiare la storia: aggiungi un dettaglio alla scena.",
] as const;

export const FABULA_GAINS = [
  "Fallimento critico (doppio 1).",
  "Entra in scena un Cattivo.",
  "Ti arrendi in un conflitto.",
] as const;

export const DIFFICULTIES = [
  { level: 7, label: "Facile" },
  { level: 10, label: "Normale" },
  { level: 13, label: "Difficile" },
  { level: 16, label: "Molto difficile" },
] as const;

// ---------------------------------------------------------------------------
// Forma della scheda
// ---------------------------------------------------------------------------

export type ClassEntry = {
  name: string;
  level: number;
  /** Bonus che la classe dà al primo livello. */
  hp: number;
  mp: number;
  ip: number;
};

export const TECHNOLOGY_DISCIPLINES = [
  { key: "alchimia", label: "Alchimia" },
  { key: "infusione", label: "Infusione" },
  { key: "magitech", label: "Magitech" },
] as const;
export type TechnologyDiscipline = (typeof TECHNOLOGY_DISCIPLINES)[number]["key"];
export type TechnologyRank = 0 | 1 | 2 | 3;
export type TechnologyOptions = Record<TechnologyDiscipline, TechnologyRank>;

export const TECHNOLOGY_TIERS = [
  { value: 0, label: "Non acquisita" },
  { value: 1, label: "Base" },
  { value: 2, label: "Avanzata" },
  { value: 3, label: "Superiore" },
] as const;

export const emptyTechnologyOptions = (): TechnologyOptions => ({
  alchimia: 0,
  infusione: 0,
  magitech: 0,
});

export function technologyOptionsSummary(options?: TechnologyOptions): string {
  if (!options) return "";
  return TECHNOLOGY_DISCIPLINES.flatMap(({ key, label }) => {
    const rank = options[key];
    if (rank === 0) return [];
    const tier = TECHNOLOGY_TIERS.find((item) => item.value === rank);
    return tier ? [`${label}: ${tier.label}`] : [];
  }).join(" · ");
}

export type SkillEntry = {
  name: string;
  /** Classe di provenienza, oppure "Eroica". */
  source: string;
  level: number;
  maxRank: number | null;
  heroic: boolean;
  summary: string;
  technologyOptions?: TechnologyOptions;
};

export type SpellEntry = {
  name: string;
  mp: string;
  target: string;
  duration: string;
  offensive: boolean;
  summary: string;
};

export type RitualEntry = {
  name: string;
  summary: string;
};

export const EQUIPMENT_ACQUISITIONS = [
  { key: "starting", label: "Equipaggiamento iniziale" },
  { key: "purchase", label: "Acquistato" },
  { key: "found", label: "Trovato" },
  { key: "reward", label: "Ricompensa" },
  { key: "gift", label: "Ricevuto" },
  { key: "unknown", label: "Non specificato" },
] as const;
export type EquipmentAcquisition = (typeof EQUIPMENT_ACQUISITIONS)[number]["key"];
export type EquipmentPaymentSource = "personal";

export type EquipmentEntry = {
  name: string;
  slot: EquipmentSlot;
  quantity: number;
  cost: number;
  acquisition: EquipmentAcquisition;
  paymentSource: EquipmentPaymentSource | null;
  sessionNumber: number | null;
  date: string;
  defense: number;
  magicDefense: number;
  initiative: number;
  summary: string;
  /** Indossato o impugnato: solo questi oggetti contano per Difesa, Difesa Magica e Iniziativa. */
  equipped: boolean;
};

/**
 * Le schede salvate prima del flag "equipaggiato" non ce l'hanno: l'equipaggiamento iniziale
 * e quello scritto a mano si considerano indossati (come prima), quello comprato, trovato o
 * ricevuto finisce nello zaino finché il giocatore non lo spunta.
 */
const equippedByDefault = (acquisition: EquipmentAcquisition) => acquisition === "starting" || acquisition === "unknown";

export type CharacterAdvancement = {
  date: string;
  sessionNumber: number | null;
  level: number;
  classes: string;
  summary: string;
};

export type Sheet = {
  attributes: Record<AttributeKey, Die>;
  classes: ClassEntry[];
  skills: SkillEntry[];
  spells: SpellEntry[];
  rituals: RitualEntry[];
  equipment: EquipmentEntry[];
  advancements: CharacterAdvancement[];
  /** Valori attuali, aggiornati a fine sessione. null = al massimo. */
  current: { hp: number | null; mp: number | null; ip: number | null };
  /**
   * Per le armature marziali, che fissano la Difesa base al posto della DES (es. Brigantina 10).
   * I bonus degli scudi e degli altri oggetti si sommano comunque.
   */
  defenseBase: number | null;
  magicDefenseBase: number | null;
  xp: number;
  zenit: number;
};

export const emptySheet = (): Sheet => ({
  attributes: { dex: 8, ins: 8, mig: 8, wlp: 8 },
  classes: [],
  skills: [],
  spells: [],
  rituals: [],
  equipment: [],
  advancements: [],
  current: { hp: null, mp: null, ip: null },
  defenseBase: null,
  magicDefenseBase: null,
  xp: 0,
  zenit: 0,
});

// ---------------------------------------------------------------------------
// Validazione: accetta qualsiasi cosa e restituisce una scheda valida
// ---------------------------------------------------------------------------

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
};
const intOrNull = (v: unknown, min: number, max: number) =>
  v === null || v === undefined || v === "" ? null : int(v, min, max, min);
const technologyRank = (value: unknown): TechnologyRank => {
  switch (int(value, 0, 3, 0)) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    default:
      return 0;
  }
};
const normalizeTechnologyOptions = (value: unknown): TechnologyOptions => {
  const options = obj(value);
  return {
    alchimia: technologyRank(options.alchimia),
    infusione: technologyRank(options.infusione),
    magitech: technologyRank(options.magitech),
  };
};
const isoDate = (v: unknown) => {
  const value = text(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
};
const die = (v: unknown): Die => (DICE.includes(Number(v) as Die) ? (Number(v) as Die) : 8);
const paymentSource = (v: unknown): EquipmentPaymentSource | null =>
  v === "personal" ? "personal" : null;
const LIST_LIMIT = 60;

export function normalizeSheet(input: unknown): Sheet {
  const s = obj(input);
  const a = obj(s.attributes);
  const c = obj(s.current);
  const base = emptySheet();

  return {
    attributes: { dex: die(a.dex), ins: die(a.ins), mig: die(a.mig), wlp: die(a.wlp) },
    classes: arr(s.classes)
      .slice(0, LIST_LIMIT)
      .map(obj)
      .map((x) => ({
        name: text(x.name, 60),
        level: int(x.level, 1, RULES.maxClassLevel, 1),
        hp: int(x.hp, 0, 99, 0),
        mp: int(x.mp, 0, 99, 0),
        ip: int(x.ip, 0, 99, 0),
      }))
      .filter((x) => x.name),
    skills: arr(s.skills)
      .slice(0, LIST_LIMIT * 2)
      .map(obj)
      .map((x) => {
        const maxRank = intOrNull(x.maxRank, 1, 10);
        const name = text(x.name, 80);
        return {
          name,
          source: text(x.source, 60),
          level: int(x.level, 1, maxRank ?? 10, 1),
          maxRank,
          heroic: x.heroic === true,
          summary: text(x.summary, 2000),
          technologyOptions: name.trim().toLocaleLowerCase("it") === "tecnologie"
            ? normalizeTechnologyOptions(x.technologyOptions)
            : undefined,
        };
      })
      .filter((x) => x.name),
    spells: arr(s.spells)
      .slice(0, LIST_LIMIT)
      .map(obj)
      .map((x) => ({
        name: text(x.name, 80),
        mp: text(x.mp, 20),
        target: text(x.target, 60),
        duration: text(x.duration, 40),
        offensive: x.offensive === true,
        summary: text(x.summary, 2000),
      }))
      .filter((x) => x.name),
    rituals: arr(s.rituals)
      .slice(0, LIST_LIMIT)
      .map(obj)
      .map((x) => ({
        name: text(x.name, 80),
        summary: text(x.summary, 2000),
      }))
      .filter((x) => x.name),
    equipment: arr(s.equipment)
      .slice(0, LIST_LIMIT)
      .map(obj)
      .map((x) => {
        const acquisition = (EQUIPMENT_ACQUISITIONS.some((entry) => entry.key === x.acquisition) ? x.acquisition : "unknown") as EquipmentAcquisition;
        return {
        name: text(x.name, 80),
        slot: (EQUIPMENT_SLOTS.some((e) => e.key === x.slot) ? x.slot : "altro") as EquipmentSlot,
        quantity: int(x.quantity, 1, 999, 1),
        cost: int(x.cost, 0, 9_999_999, 0),
        acquisition,
        equipped: typeof x.equipped === "boolean" ? x.equipped : equippedByDefault(acquisition),
        paymentSource: paymentSource(x.paymentSource),
        sessionNumber: intOrNull(x.sessionNumber, 1, 999),
        date: isoDate(x.date),
        defense: int(x.defense, -10, 20, 0),
        magicDefense: int(x.magicDefense, -10, 20, 0),
        initiative: int(x.initiative, -10, 20, 0),
        summary: text(x.summary, 2000),
        };
      })
      .filter((x) => x.name),
    advancements: arr(s.advancements)
      .slice(-200)
      .map(obj)
      .map((x) => {
        return {
          date: isoDate(x.date),
          sessionNumber: intOrNull(x.sessionNumber, 1, 999),
          level: int(x.level, 1, RULES.maxLevel, 1),
          classes: text(x.classes, 500),
          summary: text(x.summary, 1500),
        };
      })
      .filter((x) => x.summary),
    current: { hp: intOrNull(c.hp, 0, 999), mp: intOrNull(c.mp, 0, 999), ip: intOrNull(c.ip, 0, 99) },
    defenseBase: intOrNull(s.defenseBase, 0, 30),
    magicDefenseBase: intOrNull(s.magicDefenseBase, 0, 30),
    xp: int(s.xp, 0, 999, base.xp),
    zenit: int(s.zenit, 0, 9_999_999, base.zenit),
  };
}

// ---------------------------------------------------------------------------
// Valori derivati
// ---------------------------------------------------------------------------

/** Livello del personaggio: la somma dei livelli di classe. */
export const characterLevel = (sheet: Sheet, fallback: number) =>
  sheet.classes.length > 0
    ? Math.min(RULES.maxLevel, sheet.classes.reduce((sum, c) => sum + c.level, 0))
    : fallback;

export const classesLabel = (sheet: Sheet) => sheet.classes.map((c) => `${c.name} ${c.level}`).join(" · ");

export function isStartingDistribution(attributes: Sheet["attributes"]): boolean {
  const selected = ATTRIBUTES.map((attribute) => attributes[attribute.key]).sort((a, b) => a - b);
  return STARTING_DISTRIBUTIONS.some((distribution) => {
    const allowed = [...distribution].sort((a, b) => a - b);
    return selected.every((die, index) => die === allowed[index]);
  });
}

export function characterCreationErrors(sheet: Sheet): string[] {
  const errors: string[] = [];
  const classes = sheet.classes;
  const names = classes.map((entry) => entry.name.trim().toLocaleLowerCase());
  const levels = classes.reduce((sum, entry) => sum + entry.level, 0);

  if (classes.length < 2 || classes.length > 3) errors.push("Scegli due o tre Classi.");
  if (names.some((name) => !name)) errors.push("Inserisci il nome di ogni Classe.");
  if (new Set(names).size !== names.length) errors.push("Ogni Classe deve essere diversa.");
  if (levels !== RULES.startingLevel) errors.push(`Distribuisci esattamente ${RULES.startingLevel} livelli tra le Classi.`);
  if (!isStartingDistribution(sheet.attributes)) errors.push("Le Caratteristiche non corrispondono a una distribuzione iniziale valida.");

  const spent = sheet.equipment.reduce((sum, item) => sum + item.cost, 0);
  if (spent > RULES.equipmentBudget) errors.push(`L'equipaggiamento costa ${spent} Zenit: il budget iniziale è ${RULES.equipmentBudget}.`);
  return errors;
}

export type Derived = {
  level: number;
  maxHp: number;
  crisis: number;
  maxMp: number;
  maxIp: number;
  defense: number;
  magicDefense: number;
  initiative: number;
};

export function derive(sheet: Sheet, fallbackLevel: number): Derived {
  const level = characterLevel(sheet, fallbackLevel);
  const sum = (pick: (c: ClassEntry) => number) => sheet.classes.reduce((t, c) => t + pick(c), 0);
  // Solo quello che il PG indossa o impugna: gli oggetti nello zaino non danno bonus.
  const gear = (pick: (e: EquipmentEntry) => number) =>
    sheet.equipment.filter((e) => e.equipped !== false).reduce((t, e) => t + pick(e), 0);
  const { dex, ins, mig, wlp } = sheet.attributes;
  const maxHp = mig * 5 + level + sum((c) => c.hp);

  return {
    level,
    maxHp,
    crisis: Math.floor(maxHp / 2),
    maxMp: wlp * 5 + level + sum((c) => c.mp),
    maxIp: RULES.baseInventoryPoints + sum((c) => c.ip),
    defense: (sheet.defenseBase ?? dex) + gear((e) => e.defense),
    magicDefense: (sheet.magicDefenseBase ?? ins) + gear((e) => e.magicDefense),
    initiative: gear((e) => e.initiative),
  };
}

/** Forza di un Legame: una per ogni emozione. */
export const bondStrength = (emotions: string[]) => Math.min(3, emotions.length);

/** Tiene al massimo un'emozione per coppia, nell'ordine delle coppie. */
export function normalizeEmotions(emotions: string[]): string[] {
  return EMOTION_PAIRS.flatMap((pair) => {
    const chosen = pair.find((e) => emotions.includes(e));
    return chosen ? [chosen] : [];
  });
}

// ---------------------------------------------------------------------------
// Avvisi (non bloccano il salvataggio: il Master può avere regole della casa)
// ---------------------------------------------------------------------------

export function sheetWarnings(sheet: Sheet, bondCount: number): string[] {
  const w: string[] = [];
  const level = sheet.classes.reduce((t, c) => t + c.level, 0);
  if (level > RULES.maxLevel) w.push(`I livelli di classe sommano a ${level}: il massimo è ${RULES.maxLevel}.`);

  const mastered = sheet.classes.filter((c) => c.level >= RULES.maxClassLevel).length;
  const heroic = sheet.skills.filter((s) => s.heroic).length;
  if (heroic > mastered) {
    w.push(
      `Hai ${heroic} Abilità Eroiche ma ${mastered} classi al livello ${RULES.maxClassLevel}: se ne ottiene una per ogni classe padroneggiata.`,
    );
  }

  const open = sheet.classes.filter((c) => c.level < RULES.maxClassLevel).length;
  if (open > RULES.maxOpenClasses) {
    w.push(`Hai ${open} classi non padroneggiate: insieme se ne possono avere al massimo ${RULES.maxOpenClasses}.`);
  }

  if (bondCount > RULES.maxBonds) w.push(`Hai ${bondCount} Legami: il massimo è ${RULES.maxBonds}.`);

  const worn = (slot: EquipmentSlot) => sheet.equipment.filter((e) => e.equipped && e.slot === slot).length;
  if (worn("armatura") > 1) w.push("Hai più di un'armatura equipaggiata: se ne indossa una sola.");
  if (worn("accessorio") > 1) w.push("Hai più di un accessorio equipaggiato: se ne porta uno solo.");
  if (worn("arma") + worn("scudo") > 2) w.push("Armi e scudi equipaggiati sono più di due: le mani sono due.");
  return w;
}
