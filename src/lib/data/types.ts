import type { TagKind } from "@/lib/tags";

export type Role = "gm" | "player";

export type CurrentUser = { id: string; username: string; displayName: string };

export type CampaignSummary = { id: string; name: string; role: Role };

export type Campaign = CampaignSummary & { inviteCode: string | null; gmId: string };

export type Entry = {
  id: string;
  sessionNumber: number;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
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
};

export type EntityDetail = { kind: TagKind; slug: string; name: string; entries: Entry[] };

export type Thread = {
  id: string;
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
  bonds: Bond[];
};

export type Member = { userId: string; displayName: string; role: Role; characterName: string | null };
