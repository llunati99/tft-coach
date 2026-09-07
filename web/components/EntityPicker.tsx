"use client";

import { useEffect, useMemo, useState } from "react";

export interface PickerOption {
  apiName: string;
  name: string;
  iconUrl?: string;
}

interface Props {
  options: PickerOption[];
  placeholder?: string;
  onClose: () => void;
  /** Single-pick mode (e.g. correcting one existing slot): closes on click. */
  onSelect?: (apiName: string) => void;
  /** Multi-pick mode (e.g. adding several at once): stays open, lets the
   * user toggle several, and closes only when they confirm. */
  multi?: boolean;
  /** Multi-pick only: click adds one more copy instead of toggling on/off,
   * and the result can contain the same apiName more than once — for
   * things like "3 B.F. Sword" where quantity matters. */
  allowQuantity?: boolean;
  onConfirm?: (apiNames: string[]) => void;
}

export default function EntityPicker({
  options,
  placeholder,
  onSelect,
  onClose,
  multi,
  allowQuantity,
  onConfirm,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [query, options]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handlePick(apiName: string) {
    if (!multi) {
      onSelect?.(apiName);
      return;
    }
    if (allowQuantity) {
      setQuantities((prev) => ({ ...prev, [apiName]: (prev[apiName] ?? 0) + 1 }));
      return;
    }
    setSelected((prev) =>
      prev.includes(apiName) ? prev.filter((a) => a !== apiName) : [...prev, apiName]
    );
  }

  function decrement(apiName: string, e: React.MouseEvent) {
    e.stopPropagation();
    setQuantities((prev) => {
      const next = { ...prev };
      if ((next[apiName] ?? 0) <= 1) delete next[apiName];
      else next[apiName] -= 1;
      return next;
    });
  }

  const totalSelected = allowQuantity
    ? Object.values(quantities).reduce((sum, n) => sum + n, 0)
    : selected.length;

  function handleConfirm() {
    if (allowQuantity) {
      const flat = Object.entries(quantities).flatMap(([apiName, qty]) => Array(qty).fill(apiName));
      onConfirm?.(flat);
    } else {
      onConfirm?.(selected);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? "Buscar..."}
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        {allowQuantity && (
          <p className="mb-2 text-xs text-slate-500">Tocá para sumar de a una copia.</p>
        )}
        <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto">
          {filtered.map((option) => {
            const qty = quantities[option.apiName] ?? 0;
            const isSelected = !allowQuantity && multi && selected.includes(option.apiName);
            return (
              <button
                key={option.apiName}
                onClick={() => handlePick(option.apiName)}
                className={`relative flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-slate-800 ${
                  isSelected || qty > 0 ? "bg-emerald-900/50 ring-1 ring-emerald-500" : ""
                }`}
              >
                {isSelected && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-slate-950">
                    ✓
                  </span>
                )}
                {qty > 0 && (
                  <span
                    onClick={(e) => decrement(option.apiName, e)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                    title="Quitar una copia"
                  >
                    {qty}
                  </span>
                )}
                {option.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={option.iconUrl} alt={option.name} className="h-12 w-12 rounded-md object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-slate-700" />
                )}
                <span className="text-center text-xs leading-tight text-slate-200">{option.name}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-4 py-6 text-center text-sm text-slate-500">Sin resultados</p>
          )}
        </div>

        {multi && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="text-xs text-slate-400">{totalSelected} seleccionado(s)</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={totalSelected === 0}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
