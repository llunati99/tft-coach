"use client";

import { useEffect, useMemo, useState } from "react";
import type { TftGameData, TftPickup } from "@/lib/staticData";

interface Props {
  gameData: TftGameData;
  pickups?: TftPickup[];
  onClose: () => void;
  /** Single-pick mode (e.g. correcting one existing unit): closes on click. */
  onSelect?: (apiName: string) => void;
  /** Multi-pick mode (e.g. adding several units at once): stays open, lets
   * the user toggle several, and closes only when they confirm. */
  multi?: boolean;
  onConfirm?: (apiNames: string[]) => void;
}

export default function ChampionPicker({ gameData, pickups, onSelect, onClose, multi, onConfirm }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const options = useMemo(() => {
    const champs = [...gameData.champions]
      .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))
      .map((c) => ({ apiName: c.apiName, name: c.name, iconUrl: c.iconUrl }));
    const pickupOptions = (pickups ?? []).map((p) => ({
      apiName: p.apiName,
      name: p.name,
      iconUrl: p.iconUrl,
    }));

    const q = query.trim().toLowerCase();
    const all = [...pickupOptions, ...champs];
    return q ? all.filter((o) => o.name.toLowerCase().includes(q)) : all;
  }, [query, gameData.champions, pickups]);

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
    setSelected((prev) =>
      prev.includes(apiName) ? prev.filter((a) => a !== apiName) : [...prev, apiName]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar campeón u objeto..."
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto">
          {options.map((option) => {
            const isSelected = multi && selected.includes(option.apiName);
            return (
              <button
                key={option.apiName}
                onClick={() => handlePick(option.apiName)}
                className={`relative flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-slate-800 ${
                  isSelected ? "bg-emerald-900/50 ring-1 ring-emerald-500" : ""
                }`}
              >
                {isSelected && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-slate-950">
                    ✓
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
          {options.length === 0 && (
            <p className="col-span-4 py-6 text-center text-sm text-slate-500">Sin resultados</p>
          )}
        </div>

        {multi && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="text-xs text-slate-400">{selected.length} seleccionado(s)</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">
                Cancelar
              </button>
              <button
                onClick={() => onConfirm?.(selected)}
                disabled={selected.length === 0}
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
