"use client";

import { useRef, useState } from "react";
import { tagNamesAction } from "@/app/actions";
import { tagSyntax, type TagKind } from "@/lib/tags";

type Name = { kind: TagKind; name: string };
type Query = { kind: TagKind; text: string; start: number };

// Il tag che si sta scrivendo subito prima del cursore: "@Ve", "#[Culto d", "@".
const BRACKET_RE = /(?:^|[^\p{L}\p{N}_])([@#])\[([^\]\n]{0,60})$/u;
const PLAIN_RE = /(?:^|[^\p{L}\p{N}_])([@#])([\p{L}\p{N}_']{0,60})$/u;
const MAX = 6;

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function currentQuery(value: string, caret: number): Query | null {
  const before = value.slice(0, caret);
  const m = before.match(BRACKET_RE) ?? before.match(PLAIN_RE);
  if (!m) return null;
  const bracket = m[0].includes("[");
  const text = m[2];
  if (!bracket && text.length === 0) return null; // Solo "@": aspettiamo almeno una lettera.
  return { kind: m[1] === "@" ? "npc" : "place", text, start: caret - text.length - 1 - (bracket ? 1 : 0) };
}

function matches(names: Name[], q: Query): Name[] {
  const needle = fold(q.text);
  return names
    .filter((n) => n.kind === q.kind)
    .map((n) => {
      const hay = fold(n.name);
      const rank = hay.startsWith(needle) ? 0 : hay.split(/\s+/).some((w) => w.startsWith(needle)) ? 1 : hay.includes(needle) ? 2 : -1;
      return { n, rank };
    })
    .filter((x) => x.rank >= 0 && fold(x.n.name) !== needle)
    .sort((a, b) => a.rank - b.rank || a.n.name.localeCompare(b.n.name, "it"))
    .slice(0, MAX)
    .map((x) => x.n);
}

/**
 * Textarea che, mentre scrivi @… o #…, propone i personaggi e i luoghi già noti.
 * ↑ ↓ per scegliere, Invio o Tab per inserire, Esc per chiudere.
 */
export function TagTextarea({
  campaignId,
  inputRef,
  initialNames = [],
  className = "",
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "ref"> & {
  campaignId: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  initialNames?: Name[];
}) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? own;
  const [names, setNames] = useState<Name[]>(initialNames);
  const loaded = useRef(false);
  const [query, setQuery] = useState<Query | null>(null);
  const [active, setActive] = useState(0);

  const options = query ? matches(names, query) : [];
  const open = options.length > 0;

  async function load() {
    if (loaded.current) return;
    loaded.current = true;
    const fetched = await tagNamesAction(campaignId);
    setNames((prev) => {
      const seen = new Set(prev.map((n) => `${n.kind}:${fold(n.name)}`));
      return [...prev, ...fetched.filter((n) => !seen.has(`${n.kind}:${fold(n.name)}`))];
    });
  }

  function refresh() {
    const ta = ref.current;
    if (!ta) return;
    setQuery(currentQuery(ta.value, ta.selectionStart ?? ta.value.length));
    setActive(0);
  }

  function choose(n: Name) {
    const ta = ref.current;
    if (!ta || !query) return;
    const caret = ta.selectionStart ?? ta.value.length;
    // Se dopo il cursore c'è già una "]" (tag tra parentesi), la sostituiamo anche lei.
    const end = ta.value[caret] === "]" ? caret + 1 : caret;
    const token = `${tagSyntax(n.kind, n.name)} `;
    ta.value = ta.value.slice(0, query.start) + token + ta.value.slice(end);
    const pos = query.start + token.length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    setQuery(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery(null);
    }
  }

  return (
    <div className="relative">
      <textarea
        {...props}
        ref={ref}
        className={className}
        onFocus={(e) => {
          void load();
          props.onFocus?.(e);
        }}
        onInput={(e) => {
          refresh();
          props.onInput?.(e);
        }}
        onClick={refresh}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) refresh();
        }}
        onBlur={(e) => {
          // Lascia il tempo al click su un suggerimento.
          setTimeout(() => setQuery(null), 150);
          props.onBlur?.(e);
        }}
        aria-autocomplete="list"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-panel shadow-lg"
        >
          {options.map((n, i) => (
            <li key={`${n.kind}:${n.name}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(n)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === active ? "bg-panel-2" : ""}`}
              >
                <span className={`size-2 rounded-full ${n.kind === "npc" ? "bg-npc" : "bg-place"}`} />
                <b className={n.kind === "npc" ? "text-npc" : "text-place"}>{n.name}</b>
                <span className="ml-auto font-mono text-xs text-muted">{tagSyntax(n.kind, n.name)}</span>
              </button>
            </li>
          ))}
          <li className="border-t border-line px-3 py-1 text-xs text-muted">↑ ↓ per scegliere · Invio per inserire · Esc per chiudere</li>
        </ul>
      )}
    </div>
  );
}
