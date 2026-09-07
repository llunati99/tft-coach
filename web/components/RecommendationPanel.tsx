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
      <span className="rounded-full bg-emerald-900/60 px-3 py-1 text-xs font-medium text-emerald-300 whitespace-nowrap">
        Real — {recommendation.sampleSize} partidas
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-900/60 px-3 py-1 text-xs font-medium text-amber-300 whitespace-nowrap">
      Estimado por IA
    </span>
  );
}

function ChampionIcon({
  apiName,
  championByApiName,
}: {
  apiName: string;
  championByApiName: Map<string, TftGameData["champions"][number]>;
}) {
  const champion = championByApiName.get(apiName);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-2 py-1">
      {champion?.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={champion.iconUrl} alt={champion.name} className="h-8 w-8 rounded-md object-cover" />
      ) : (
        <div className="h-8 w-8 rounded-md bg-slate-700" />
      )}
      <span className="text-sm text-slate-200">{champion?.name ?? apiName}</span>
    </div>
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
      {/* Main takeaway — big and short, this is the whole point of the app */}
      <p className="mb-2 text-xl font-semibold leading-snug text-white">{recommendation.shortAdvice}</p>

      {recommendation.buyFromShop.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {recommendation.buyFromShop.map((apiName) => (
            <ChampionIcon key={apiName} apiName={apiName} championByApiName={championByApiName} />
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
        <span>{recommendation.compDirection}</span>
        <StatsBadge recommendation={recommendation} />
      </div>

      {recommendation.priorityChampions.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">También buscar</p>
          <div className="flex flex-wrap gap-2">
            {recommendation.priorityChampions.map((apiName) => (
              <ChampionIcon key={apiName} apiName={apiName} championByApiName={championByApiName} />
            ))}
          </div>
        </div>
      )}

      {recommendation.itemSuggestions.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Items</p>
          <div className="flex flex-col gap-1">
            {recommendation.itemSuggestions.map((s, i) => {
              const champ = championByApiName.get(s.unit);
              const item = itemByApiName.get(s.item);
              return (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                  <span>{champ?.name ?? s.unit} → {item?.name ?? s.item}</span>
                  <span className="text-xs text-slate-500">({s.reason})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recommendation.pickupAdvice && (
        <div className="mb-3 rounded-lg bg-indigo-950/50 p-2 text-sm text-indigo-200">
          🎁 {recommendation.pickupAdvice}
        </div>
      )}

      {recommendation.benchAdvice.length > 0 && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Banca</p>
          <div className="flex flex-col gap-1">
            {recommendation.benchAdvice.map((b, i) => {
              const champ = championByApiName.get(b.unit);
              const actionStyle =
                b.action === "vender"
                  ? "bg-red-900/60 text-red-300"
                  : b.action === "tablero"
                  ? "bg-blue-900/60 text-blue-300"
                  : "bg-slate-700 text-slate-300";
              return (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${actionStyle}`}>
                    {b.action}
                  </span>
                  <span>{champ?.name ?? b.unit}</span>
                  <span className="text-xs text-slate-500">({b.reason})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
