"use client";

import { useMemo, useState } from "react";
import type { TftGameData, TftPickup } from "@/lib/staticData";

interface Props {
  gameData: TftGameData;
  pickups?: TftPickup[];
  onSelect: (apiName: string) => void;
  onClose: () => void;
}

export default function ChampionPicker({ gameData, pickups, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar campeón u objeto..."
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.apiName}
              onClick={() => onSelect(option.apiName)}
              className="flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-slate-800"
            >
              {option.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.iconUrl} alt={option.name} className="h-12 w-12 rounded-md object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-md bg-slate-700" />
              )}
              <span className="text-center text-xs leading-tight text-slate-200">{option.name}</span>
            </button>
          ))}
          {options.length === 0 && (
            <p className="col-span-4 py-6 text-center text-sm text-slate-500">Sin resultados</p>
          )}
        </div>
      </div>
    </div>
  );
}
