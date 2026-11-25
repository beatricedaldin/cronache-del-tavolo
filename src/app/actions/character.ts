"use server";

import {
  addBond,
  acquireCharacterEquipment,
  deleteBond,
  createMyCharacter,
  removeMyPortrait,
  saveMyCharacter,
  setMyPortrait,
  updateBond,
} from "@/lib/data/characters";
import { EQUIPMENT_SLOTS, normalizeSheet, RULES, type EquipmentAcquisition, type EquipmentSlot } from "@/lib/fabula";
import { todayISO } from "@/lib/dates";
import { dateOf, errorMessage, int, optionalSession, revalidateCampaign, str, type FormState } from "@/lib/form";

export async function saveCharacterAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: "Il personaggio ha bisogno di un nome." };
  const advancementSummary = str(fd, "advancementSummary");
  const advancementSession = optionalSession(fd, "advancementSession");
  if (advancementSummary.length > 1500) return { error: "La nota sui progressi non può superare 1500 caratteri." };
  if ("error" in advancementSession) return { error: advancementSession.error };
  const sessionNumber = advancementSession.value;
  if (sessionNumber !== null && !advancementSummary) {
    return { error: "Descrivi l'avanzamento da registrare per questa sessione." };
  }
  let sheet: unknown;
  try {
    sheet = JSON.parse(String(fd.get("sheet") ?? "{}"));
  } catch {
    return { error: "La scheda non è leggibile. Ricarica la pagina e riprova." };
  }
  const version = str(fd, "version");
  if (!version) return { error: "La scheda non è leggibile. Ricarica la pagina e riprova." };
  try {
    await saveMyCharacter(campaignId, {
      name,
      identity: str(fd, "identity"),
      theme: str(fd, "theme"),
      origin: str(fd, "origin"),
      fabulaPoints: Math.min(99, Math.max(0, int(fd, "fabulaPoints", 3))),
      notes: str(fd, "notes"),
      sheet: normalizeSheet(sheet),
    }, version, advancementSummary ? { sessionNumber, summary: advancementSummary } : undefined);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateCampaign(campaignId);
  return { ok: true, message: "Scheda salvata.", at: Date.now() };
}

export async function createCharacterAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  if (!name) return { error: "Il personaggio ha bisogno di un nome." };
  let sheet: unknown;
  try {
    sheet = JSON.parse(String(fd.get("sheet") ?? "{}"));
  } catch {
    return { error: "La scheda non è leggibile. Ricarica la pagina e riprova." };
  }
  const savingsRoll = Number(str(fd, "savingsRoll"));
  if (!Number.isInteger(savingsRoll) || savingsRoll < 2 || savingsRoll > 12) {
    return { error: "Inserisci il risultato del tiro 2d6 per i risparmi iniziali." };
  }
  try {
    await createMyCharacter(campaignId, {
      name,
      identity: str(fd, "identity"),
      theme: str(fd, "theme"),
      origin: str(fd, "origin"),
      fabulaPoints: RULES.startingFabulaPoints,
      notes: str(fd, "notes"),
      sheet: normalizeSheet(sheet),
    }, savingsRoll);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateCampaign(campaignId);
  return { ok: true, message: "Personaggio creato. Ora puoi aggiungere i Legami.", at: Date.now() };
}

export async function acquireCharacterEquipmentAction(
  campaignId: string,
  characterId: string,
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const name = str(fd, "name");
  const slot = equipmentSlotFrom(str(fd, "slot"));
  const acquisition = equipmentAcquisitionFrom(str(fd, "acquisition"));
  const payment = str(fd, "paymentSource");
  const quantity = Number(str(fd, "quantity"));
  const cost = Number(str(fd, "cost"));
  const session = optionalSession(fd, "session");
  const dateText = str(fd, "date");
  const date = dateOf(fd, "date");
  const acquiredOn = date ?? todayISO();
  const paymentSource: "personal" | null = payment === "personal" ? "personal" : null;
  const numericField = (key: string) => {
    const value = str(fd, key);
    return value ? Number(value) : 0;
  };
  const defense = numericField("defense");
  const magicDefense = numericField("magicDefense");
  const initiative = numericField("initiative");
  const summary = str(fd, "summary");

  if (!name || name.length > 80) return { error: "Inserisci un nome valido per l'oggetto (massimo 80 caratteri)." };
  if (!slot) return { error: "Scegli un tipo di equipaggiamento valido." };
  if (!acquisition) return { error: "Scegli come è stato ottenuto l'oggetto." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: "La quantità deve essere compresa tra 1 e 999." };
  if (acquisition === "purchase") {
    if (!Number.isInteger(cost) || cost < 1 || cost > 9_999_999) return { error: "Inserisci un costo valido per l'acquisto." };
    if (!paymentSource) return { error: "L'acquisto può essere addebitato solo ai tuoi Zenit personali." };
  }
  if (dateText && !date) return { error: "La data dell'oggetto non è valida." };
  if ("error" in session) return { error: session.error };
  const sessionNumber = session.value;
  if (summary.length > 2000) return { error: "Il promemoria non può superare 2000 caratteri." };
  if ([defense, magicDefense, initiative].some((value) => !Number.isInteger(value) || value < -10 || value > 20)) {
    return { error: "I bonus devono essere numeri interi tra -10 e 20." };
  }

  try {
    await acquireCharacterEquipment(characterId, {
      name,
      slot,
      quantity,
      cost: acquisition === "purchase" ? cost : 0,
      acquisition,
      paymentSource: acquisition === "purchase" ? paymentSource : null,
      sessionNumber,
      acquiredOn,
      defense,
      magicDefense,
      initiative,
      summary,
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateCampaign(campaignId);
  return { ok: true, message: "Oggetto registrato nella scheda e nei saldi pertinenti.", at: Date.now() };
}

function equipmentSlotFrom(value: string): EquipmentSlot | null {
  return EQUIPMENT_SLOTS.find((entry) => entry.key === value)?.key ?? null;
}

function equipmentAcquisitionFrom(value: string): Exclude<EquipmentAcquisition, "starting" | "unknown"> | null {
  switch (value) {
    case "purchase":
    case "found":
    case "reward":
    case "gift":
      return value;
    default:
      return null;
  }
}

/** Le emozioni scelte: un campo radio per ciascuna coppia ("pair0", "pair1", "pair2"). */
const emotionsFrom = (fd: FormData) => [0, 1, 2].map((i) => str(fd, `pair${i}`)).filter(Boolean);

export async function addBondAction(campaignId: string, characterId: string, _: FormState, fd: FormData): Promise<FormState> {
  const target = str(fd, "target");
  const at = Date.now();
  if (!target) return { error: "Verso chi è il Legame?", at };
  try {
    await addBond(characterId, target, emotionsFrom(fd));
  } catch (e) {
    return { error: errorMessage(e), values: { target }, at };
  }
  revalidateCampaign(campaignId);
  return { ok: true, at };
}

export async function updateBondAction(campaignId: string, bondId: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await updateBond(bondId, emotionsFrom(fd));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateCampaign(campaignId);
  return { ok: true, message: "Aggiornato." };
}

export async function deleteBondAction(campaignId: string, bondId: string) {
  await deleteBond(bondId);
  revalidateCampaign(campaignId);
}

export async function setPortraitAction(campaignId: string, _: FormState, fd: FormData): Promise<FormState> {
  try {
    await setMyPortrait(campaignId, fd.get("image"));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidateCampaign(campaignId);
  return { ok: true, at: Date.now() };
}

export async function removePortraitAction(campaignId: string) {
  await removeMyPortrait(campaignId);
  revalidateCampaign(campaignId);
}
