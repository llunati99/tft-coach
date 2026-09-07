"use client";

import { useMemo } from "react";
import type { TftGameData } from "@/lib/staticData";
import type { BoardReading, BoardUnitReading } from "@/lib/anthropic";

interface Props {
  board: BoardReading;
  gameData: TftGameData;
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
    <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-800 p-2 w-16">
      {champion?.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={champion.iconUrl} alt={champion.name} className="h-10 w-10 rounded-md object-cover" />
      ) : (
        <div className="h-10 w-10 rounded-md bg-slate-700" />
      )}
      <span className="text-[10px] text-slate-200 text-center leading-tight">
        {champion?.name ?? apiName}
      </span>
    </div>
  );
}

function UnitChip({
  unit,
  championByApiName,
  itemByApiName,
}: {
  unit: BoardUnitReading;
  championByApiName: Map<string, TftGameData["champions"][number]>;
  itemByApiName: Map<string, TftGameData["items"][number]>;
}) {
  const champion = championByApiName.get(unit.apiName);
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-800 p-2 w-20">
      {champion?.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={champion.iconUrl} alt={champion.name} className="h-12 w-12 rounded-md object-cover" />
      ) : (
        <div className="h-12 w-12 rounded-md bg-slate-700" />
      )}
      <span className="text-xs text-slate-200 text-center leading-tight">
        {champion?.name ?? unit.apiName}
      </span>
      <span className="text-[10px] text-amber-400">{"★".repeat(unit.star)}</span>
      {unit.items.length > 0 && (
        <div className="flex gap-0.5">
          {unit.items.map((itemId, i) => {
            const item = itemByApiName.get(itemId);
            return item?.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={item.iconUrl} alt={item.name} title={item.name} className="h-4 w-4 rounded-sm" />
            ) : (
              <div key={i} className="h-4 w-4 rounded-sm bg-slate-600" title={itemId} />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BoardPreview({ board, gameData }: Props) {
  const championByApiName = useMemo(
    () => new Map(gameData.champions.map((c) => [c.apiName, c])),
    [gameData]
  );
  const itemByApiName = useMemo(() => new Map(gameData.items.map((i) => [i.apiName, i])), [gameData]);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-300">
        <span>Nivel <strong className="text-white">{board.level}</strong></span>
        <span>Oro <strong className="text-white">{board.gold}</strong></span>
        <span>Stage <strong className="text-white">{board.stage}</strong></span>
        {board.augments.length > 0 && (
          <span>Aumentos: <strong className="text-white">{board.augments.join(", ")}</strong></span>
        )}
      </div>

      {board.shop.length > 0 && (
        <>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Tienda</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {board.shop.map((apiName, i) => (
              <ChampionIcon key={i} apiName={apiName} championByApiName={championByApiName} />
            ))}
          </div>
        </>
      )}

      <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Tablero</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {board.units.map((unit, i) => (
          <UnitChip key={i} unit={unit} championByApiName={championByApiName} itemByApiName={itemByApiName} />
        ))}
        {board.units.length === 0 && <p className="text-sm text-slate-500">(sin unidades detectadas)</p>}
      </div>

      {board.bench.length > 0 && (
        <>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Banca</p>
          <div className="flex flex-wrap gap-2">
            {board.bench.map((unit, i) => (
              <UnitChip key={i} unit={unit} championByApiName={championByApiName} itemByApiName={itemByApiName} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
