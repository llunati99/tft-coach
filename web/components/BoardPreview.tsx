"use client";

import { useMemo, useState } from "react";
import type { TftGameData } from "@/lib/staticData";
import type { BoardReading, BoardUnitReading } from "@/lib/anthropic";
import ChampionPicker from "./ChampionPicker";

interface Props {
  board: BoardReading;
  gameData: TftGameData;
  onChange: (board: BoardReading) => void;
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

type Group = "units" | "bench";

function StarRating({ star, onSet }: { star: number; onSet: (star: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          onClick={() => onSet(n)}
          className={n <= star ? "text-[11px] text-amber-400" : "text-[11px] text-slate-600 hover:text-amber-500/60"}
          title={`${n} estrella${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function BoardPreview({ board, gameData, onChange }: Props) {
  const [editing, setEditing] = useState<{ group: Group; index: number } | null>(null);
  const [adding, setAdding] = useState<Group | null>(null);

  const championByApiName = useMemo(
    () => new Map(gameData.champions.map((c) => [c.apiName, c])),
    [gameData]
  );
  const itemByApiName = useMemo(() => new Map(gameData.items.map((i) => [i.apiName, i])), [gameData]);

  function updateUnit(group: Group, index: number, updated: BoardUnitReading | null) {
    const list = [...board[group]];
    if (updated) {
      list[index] = updated;
    } else {
      list.splice(index, 1);
    }
    onChange({ ...board, [group]: list });
  }

  function setStar(group: Group, index: number, star: number) {
    updateUnit(group, index, { ...board[group][index], star });
  }

  function addUnit(group: Group, apiName: string) {
    onChange({ ...board, [group]: [...board[group], { apiName, star: 1, items: [] }] });
    setAdding(null);
  }

  function renderUnit(unit: BoardUnitReading, group: Group, index: number) {
    const champion = championByApiName.get(unit.apiName);
    return (
      <div key={index} className="relative flex flex-col items-center gap-1 rounded-lg bg-slate-800 p-2 w-20">
        <button
          onClick={() => updateUnit(group, index, null)}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-[10px] text-slate-400 hover:text-red-400"
          title="Quitar"
        >
          ×
        </button>
        <button onClick={() => setEditing({ group, index })} className="flex flex-col items-center gap-1">
          {champion?.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={champion.iconUrl} alt={champion.name} className="h-12 w-12 rounded-md object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-md bg-slate-700" />
          )}
          <span className="text-xs text-slate-200 text-center leading-tight">
            {champion?.name ?? unit.apiName}
          </span>
        </button>
        <StarRating star={unit.star} onSet={(star) => setStar(group, index, star)} />
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

      <p className="mb-3 text-xs text-slate-500">
        Tocá un campeón para corregirlo, la ✕ para quitarlo, o las estrellas para cambiarlas.
      </p>

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

      <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        Tablero
        <button onClick={() => setAdding("units")} className="text-emerald-400 hover:text-emerald-300">
          + agregar
        </button>
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {board.units.map((unit, i) => renderUnit(unit, "units", i))}
        {board.units.length === 0 && <p className="text-sm text-slate-500">(sin unidades detectadas)</p>}
      </div>

      <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        Banca
        <button onClick={() => setAdding("bench")} className="text-emerald-400 hover:text-emerald-300">
          + agregar
        </button>
      </p>
      <div className="flex flex-wrap gap-2">
        {board.bench.map((unit, i) => renderUnit(unit, "bench", i))}
        {board.bench.length === 0 && <p className="text-sm text-slate-500">(vacía)</p>}
      </div>

      {editing && (
        <ChampionPicker
          gameData={gameData}
          onClose={() => setEditing(null)}
          onSelect={(apiName) => {
            const unit = board[editing.group][editing.index];
            updateUnit(editing.group, editing.index, { ...unit, apiName });
            setEditing(null);
          }}
        />
      )}

      {adding && (
        <ChampionPicker
          gameData={gameData}
          onClose={() => setAdding(null)}
          onSelect={(apiName) => addUnit(adding, apiName)}
        />
      )}
    </div>
  );
}
