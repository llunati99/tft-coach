"use client";

import { useMemo } from "react";
import type { TftGameData } from "@/lib/staticData";
import type { Recommendation, UnitAdvice, BenchAdvice } from "@/lib/anthropic";

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

function actionStyle(action: "vender" | "mantener" | "tablero" | "banca") {
  if (action === "vender") return "bg-red-900/60 text-red-300";
  if (action === "tablero") return "bg-blue-900/60 text-blue-300";
  if (action === "banca") return "bg-slate-600 text-slate-200";
  return "bg-slate-700 text-slate-300";
}

function UnitActionRow({
  advice,
  championByApiName,
}: {
  advice: UnitAdvice | BenchAdvice;
  championByApiName: Map<string, TftGameData["champions"][number]>;
}) {
  const champ = championByApiName.get(advice.unit);
  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${actionStyle(advice.action)}`}>
        {advice.action}
      </span>
      <span>{champ?.name ?? advice.unit}</span>
      <span className="text-xs text-slate-500">({advice.reason})</span>
    </div>
  );
}

/** One of the four questions the player always wants answered fast:
 * ¿comprar? ¿rerollear? ¿poner item? ¿vender/banquear algo? */
function QuickAnswer({ icon, label, advice }: { icon: string; label: string; advice: string }) {
  if (!advice) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-800/60 p-2">
      <span className="text-lg leading-none">{icon}</span>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm text-slate-200">{advice}</p>
      </div>
    </div>
  );
}

export default function RecommendationPanel({ recommendation, gameData }: Props) {
  const championByApiName = useMemo(
    () => new Map(gameData.champions.map((c) => [c.apiName, c])),
    [gameData]
  );
  const itemByApiName = useMemo(() => new Map(gameData.items.map((i) => [i.apiName, i])), [gameData]);

  const unitAndBenchAdvice = [...recommendation.unitAdvice, ...recommendation.benchAdvice];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
      {/* Main takeaway — big and short, this is the whole point of the app */}
      <p className="mb-2 text-xl font-semibold leading-snug text-white">{recommendation.shortAdvice}</p>

      <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
        <span>{recommendation.compDirection}</span>
        <StatsBadge recommendation={recommendation} />
      </div>

      {/* The 4 questions the player always wants answered, fast */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <QuickAnswer icon="🛒" label="¿Comprar de la tienda?" advice={recommendation.shopAdvice} />
        <QuickAnswer icon="🎲" label="¿Rerollear?" advice={recommendation.rerollAdvice} />
        <QuickAnswer icon="⚔️" label="¿Poner algún item?" advice={recommendation.itemAdvice} />
        <QuickAnswer
          icon="💰"
          label="¿Vender o cambiar alguna unidad?"
          advice={
            unitAndBenchAdvice.length > 0
              ? unitAndBenchAdvice.map((a) => `${championByApiName.get(a.unit)?.name ?? a.unit}: ${a.action}`).join(" · ")
              : ""
          }
        />
      </div>

      {recommendation.buyFromShop.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-emerald-500">Comprar de la tienda ahora</p>
          <div className="flex flex-wrap gap-2">
            {recommendation.buyFromShop.map((apiName, i) => (
              <ChampionIcon key={`${apiName}-${i}`} apiName={apiName} championByApiName={championByApiName} />
            ))}
          </div>
        </div>
      )}

      {recommendation.priorityChampions.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">También buscar</p>
          <div className="flex flex-wrap gap-2">
            {recommendation.priorityChampions.map((apiName, i) => (
              <ChampionIcon key={`${apiName}-${i}`} apiName={apiName} championByApiName={championByApiName} />
            ))}
          </div>
        </div>
      )}

      {recommendation.itemSuggestions.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Detalle de items</p>
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

      {recommendation.specialOfferAdvice && (
        <div className="mb-3 rounded-lg bg-indigo-950/50 p-2 text-sm text-indigo-200">
          🎁 {recommendation.specialOfferAdvice}
        </div>
      )}

      {unitAndBenchAdvice.length > 0 && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Detalle de unidades</p>
          <div className="flex flex-col gap-1">
            {recommendation.unitAdvice.map((a, i) => (
              <UnitActionRow key={`unit-${i}`} advice={a} championByApiName={championByApiName} />
            ))}
            {recommendation.benchAdvice.map((a, i) => (
              <UnitActionRow key={`bench-${i}`} advice={a} championByApiName={championByApiName} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
