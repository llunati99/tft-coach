"use client";

import type { TftGameData } from "@/lib/staticData";
import type { BoardReading } from "@/lib/anthropic";

interface Props {
  snapshots: BoardReading[];
  gameData: TftGameData;
  onRemove: (index: number) => void;
}

export default function MatchHistoryPanel({ snapshots, gameData, onRemove }: Props) {
  if (snapshots.length === 0) return null;

  const championByApiName = new Map(gameData.champions.map((c) => [c.apiName, c]));

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
        Historial de esta partida ({snapshots.length})
      </p>
      <div className="flex flex-col gap-2">
        {snapshots.map((snap, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm">
            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs font-medium text-slate-300">
              {snap.stage || "?"}
            </span>
            <span className="flex-1 truncate text-slate-300">
              {snap.units.length > 0
                ? snap.units
                    .map((u) => championByApiName.get(u.apiName)?.name ?? u.apiName)
                    .join(", ")
                : "(sin unidades)"}
            </span>
            <button
              onClick={() => onRemove(i)}
              className="text-slate-500 hover:text-red-400"
              title="Quitar del historial"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
