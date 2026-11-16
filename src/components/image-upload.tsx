"use client";

import { startTransition, useActionState, useState } from "react";
import type { FormState } from "@/lib/form";

const MAX_SIDE = 1600;

/** Riduce l'immagine nel browser (lato lungo 1600 px, WebP): resta leggera anche se arriva da una fotocamera. */
async function shrink(file: File): Promise<File> {
  if (file.type === "image/gif") return file; // Le GIF animate restano come sono.
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}

export function ImageUpload({
  upload,
  remove,
  hasImage,
  label = "Carica immagine",
}: {
  upload: (prev: FormState, fd: FormData) => Promise<FormState>;
  remove?: () => Promise<void>;
  hasImage: boolean;
  label?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(upload, {});
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("image", await shrink(file));
    setBusy(false);
    input.value = "";
    startTransition(() => action(fd));
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className={`btn-ghost cursor-pointer ${busy || pending ? "pointer-events-none opacity-50" : ""}`}>
        {busy || pending ? "Carico…" : hasImage ? "Cambia immagine" : label}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={onPick} />
      </label>
      {hasImage && remove && (
        <form
          action={remove}
          onSubmit={(e) => {
            if (!confirm("Togliere l'immagine?")) e.preventDefault();
          }}
        >
          <button type="submit" className="text-xs font-bold text-muted hover:text-danger">
            Togli immagine
          </button>
        </form>
      )}
      {state.error && <span className="font-bold text-danger">{state.error}</span>}
    </div>
  );
}
