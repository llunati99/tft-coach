"use client";

import { useMemo, useState } from "react";
import type { TftGameData } from "@/lib/staticData";

interface Props {
  gameData: TftGameData;
  onSelect: (apiName: string) => void;
  onClose: () => void;
}

export default function ChampionPicker({ gameData, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const champs = [...gameData.champions].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
    if (!q) return champs;
    return champs.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, gameData.champions]);

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
          placeholder="Buscar campeón..."
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto">
          {filtered.map((champ) => (
            <button
              key={champ.apiName}
              onClick={() => onSelect(champ.apiName)}
              className="flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-slate-800"
            >
              {champ.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={champ.iconUrl} alt={champ.name} className="h-12 w-12 rounded-md object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-md bg-slate-700" />
              )}
              <span className="text-center text-xs leading-tight text-slate-200">{champ.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-4 py-6 text-center text-sm text-slate-500">Sin resultados</p>
          )}
        </div>
      </div>
    </div>
  );
}
