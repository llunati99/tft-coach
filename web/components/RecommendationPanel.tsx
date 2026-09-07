"use client";

import { useMemo } from "react";
import type { TftGameData } from "@/lib/staticData";
import type { Recommendation } from "@/lib/anthropic";

interface Props {
  recommendation: Recommendation;
  gameData: TftGameData;
}

function StatsBadge({ recommendation }: { recommendation: Recommendation }) {
  if (recommendation.statsSource === "real") {
    return (
      <span className="rounded-full bg-emerald-900/60 px-3 py-1 text-xs font-medium text-emerald-300">
        Dato real — {recommendation.sampleSize} partidas
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-900/60 px-3 py-1 text-xs font-medium text-amber-300">
      Estimado por IA — todavía sin datos reales suficientes
    </span>
  );
}

export default function RecommendationPanel({ recommendation, gameData }: Props) {
  const championByApiName = useMemo(
    () => new Map(gameData.champions.map((c) => [c.apiName, c])),
    [gameData]
  );
  const itemByApiName = useMemo(() => new Map(gameData.items.map((i) => [i.apiName, i])), [gameData]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">{recommendation.compDirection}</h2>
        <StatsBadge recommendation={recommendation} />
      </div>

      <p className="mb-4 text-sm text-slate-300">{recommendation.reasoning}</p>

      {recommendation.priorityChampions.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Buscar / comprar</p>
          <div className="flex flex-wrap gap-2">
            {recommendation.priorityChampions.map((apiName) => {
              const champ = championByApiName.get(apiName);
              return (
                <div key={apiName} className="flex items-center gap-2 rounded-lg bg-slate-800 px-2 py-1">
                  {champ?.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={champ.iconUrl} alt={champ.name} className="h-8 w-8 rounded-md object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-slate-700" />
                  )}
                  <span className="text-sm text-slate-200">{champ?.name ?? apiName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recommendation.itemSuggestions.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Items sugeridos</p>
          <div className="flex flex-col gap-2">
            {recommendation.itemSuggestions.map((s, i) => {
              const champ = championByApiName.get(s.unit);
              const item = itemByApiName.get(s.item);
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-800 p-2">
                  {champ?.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={champ.iconUrl} alt={champ.name} className="h-8 w-8 rounded-md object-cover" />
                  )}
                  <span className="text-slate-500">+</span>
                  {item?.iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.iconUrl} alt={item.name} className="h-6 w-6 rounded-sm" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-200">
                      {champ?.name ?? s.unit} → {item?.name ?? s.item}
                    </span>
                    <span className="text-xs text-slate-400">{s.reason}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
