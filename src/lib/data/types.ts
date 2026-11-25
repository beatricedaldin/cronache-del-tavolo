import type { Sheet } from "@/lib/fabula";
import type { TagKind } from "@/lib/tags";

export type Role = "gm" | "player";

export type CurrentUser = { id: string; username: string; displayName: string };

/** personal: campagna personale, tenuta da un giocatore da solo (vedi migrazione 0017). */
export type CampaignSummary = { id: string; name: string; role: Role; personal: boolean };

export type Campaign = CampaignSummary & { inviteCode: string | null; gmId: string };

/**
 * Vede la campagna da Master: le note di tutti e l'elenco dei giocatori al posto della scheda.
 * In una campagna personale chi l'ha creata è Master solo sulla carta: la vive da giocatore.
 */
export const seesAsMaster = (c: Pick<CampaignSummary, "role" | "personal">) => c.role === "gm" && !c.personal;

export type Entry = {
  id: string;
  sessionNumber: number;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  isPublic: boolean;
  updatedAt: string | null;
  /** Data della voce scelta da chi scrive (AAAA-MM-GG). */
  date: string;
};

export type EntitySummary = {
  kind: TagKind;
  slug: string;
  name: string;
  mentions: number;
  firstSession: number | null;
  lastSession: number | null;
  /** Solo per il Master: quanti giocatori l'hanno citata. */
  authors: number;
  /** Il Master ha scritto la scheda pubblica (descrizione/immagine). */
  hasCard: boolean;
  /** Note del compendio visibili all'utente. */
  notes: number;
};

export type EntityCard = { name: string; description: string };

/** L'immagine di un PNG o luogo: la carica chiunque nella campagna. */
export type EntityImage = { path: string; url: string | null; uploadedBy: string; uploaderName: string };

export type EntityNote = {
  id: string;
  ownerId: string;
  ownerName: string;
  body: string;
  isPublic: boolean;
  /** Data della nota scelta da chi scrive (AAAA-MM-GG). */
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type EntityRelation = {
  id: string;
  ownerId: string;
  ownerName: string;
  label: string;
  /** "out": questa entità → etichetta → altra. "in": altra → etichetta → questa entità. */
  direction: "out" | "in";
  other: { kind: TagKind; slug: string; name: string };
  isPublic: boolean;
};

export type EntityDetail = {
  kind: TagKind;
  slug: string;
  name: string;
  entries: Entry[];
  card: EntityCard | null;
  image: EntityImage | null;
  notes: EntityNote[];
  relations: EntityRelation[];
};

export type ThreadKind = "question" | "goal";

export type Thread = {
  id: string;
  kind: ThreadKind;
  text: string;
  openedSession: number;
  resolvedSession: number | null;
  ownerId: string;
  ownerName: string;
};

export type Bond = { id: string; target: string; emotions: string[] };

export type Character = {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  classes: string;
  level: number;
  identity: string;
  theme: string;
  origin: string;
  fabulaPoints: number;
  notes: string;
  sheet: Sheet;
  portraitPath: string | null;
  portraitUrl: string | null;
  bonds: Bond[];
};

export type Member = { userId: string; displayName: string; role: Role; characterName: string | null };
