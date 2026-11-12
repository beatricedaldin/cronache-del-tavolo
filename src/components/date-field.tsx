import { todayISO } from "@/lib/dates";

/** Campo data per diario e note: di default oggi, si può cambiare. */
export function DateField({ defaultValue, name = "date" }: { defaultValue?: string; name?: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Data
      <input type="date" name={name} defaultValue={defaultValue || todayISO()} className="field w-auto py-1.5" />
    </label>
  );
}
