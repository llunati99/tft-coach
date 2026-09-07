"use client";

import { useMemo, useState } from "react";
import type { TftGameData } from "@/lib/staticData";
import { computeActiveTraits } from "@/lib/staticData";
import type { BoardReading, BoardUnitReading } from "@/lib/anthropic";
import EntityPicker, { type PickerOption } from "./EntityPicker";

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

type EditTarget = { kind: "unit"; group: Group; index: number } | { kind: "looseItem"; apiName: string };
type AddTarget = Group | "looseItems";

export default function BoardPreview({ board, gameData, onChange }: Props) {
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [adding, setAdding] = useState<AddTarget | null>(null);

  const championByApiName = useMemo(
    () => new Map(gameData.champions.map((c) => [c.apiName, c])),
    [gameData]
  );
  const itemByApiName = useMemo(() => new Map(gameData.items.map((i) => [i.apiName, i])), [gameData]);
  const pickupByApiName = useMemo(() => new Map(gameData.pickups.map((p) => [p.apiName, p])), [gameData]);
  const pickupApiNames = useMemo(() => new Set(gameData.pickups.map((p) => p.apiName)), [gameData]);

  const championOptions: PickerOption[] = useMemo(
    () =>
      [...gameData.champions]
        .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))
        .map((c) => ({ apiName: c.apiName, name: c.name, iconUrl: c.iconUrl })),
    [gameData]
  );
  const pickupOptions: PickerOption[] = useMemo(
    () => gameData.pickups.map((p) => ({ apiName: p.apiName, name: p.name, iconUrl: p.iconUrl })),
    [gameData]
  );
  const itemOptions: PickerOption[] = useMemo(
    () =>
      [...gameData.items]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => ({ apiName: i.apiName, name: i.name, iconUrl: i.iconUrl })),
    [gameData]
  );

  // All traits contributed by units on board — active AND in-progress —
  // so the player can see what they're building toward, not just what's
  // already active.
  const boardTraits = useMemo(
    () => computeActiveTraits(board.units.map((u) => u.apiName), gameData),
    [board.units, gameData]
  );
  const traitByName = useMemo(() => new Map(gameData.traits.map((t) => [t.name, t])), [gameData]);

  function nextThreshold(traitName: string, numUnits: number): number | null {
    const trait = traitByName.get(traitName);
    if (!trait) return null;
    const upcoming = trait.effects
      .map((e) => e.minUnits)
      .filter((min) => min > numUnits)
      .sort((a, b) => a - b);
    return upcoming[0] ?? null;
  }

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

  function addUnits(group: Group, apiNames: string[]) {
    const newUnits = apiNames.map((apiName) => ({ apiName, star: 1, items: [] }));
    onChange({ ...board, [group]: [...board[group], ...newUnits] });
    setAdding(null);
  }

  function addLooseItems(apiNames: string[]) {
    onChange({ ...board, looseItems: [...board.looseItems, ...apiNames] });
    setAdding(null);
  }

  function addLooseItemCopy(apiName: string) {
    onChange({ ...board, looseItems: [...board.looseItems, apiName] });
  }

  function removeLooseItemCopy(apiName: string) {
    const index = board.looseItems.indexOf(apiName);
    if (index === -1) return;
    const list = [...board.looseItems];
    list.splice(index, 1);
    onChange({ ...board, looseItems: list });
  }

  function replaceLooseItemCopy(oldApiName: string, newApiName: string) {
    const index = board.looseItems.indexOf(oldApiName);
    if (index === -1) return;
    const list = [...board.looseItems];
    list[index] = newApiName;
    onChange({ ...board, looseItems: list });
  }

  const looseItemGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const apiName of board.looseItems) counts.set(apiName, (counts.get(apiName) ?? 0) + 1);
    return Array.from(counts.entries()).map(([apiName, count]) => ({ apiName, count }));
  }, [board.looseItems]);

  function renderUnit(unit: BoardUnitReading, group: Group, index: number) {
    const isPickup = pickupApiNames.has(unit.apiName);
    const entity = isPickup ? pickupByApiName.get(unit.apiName) : championByApiName.get(unit.apiName);
    return (
      <div key={index} className="relative flex flex-col items-center gap-1 rounded-lg bg-slate-800 p-2 w-20">
        <button
          onClick={() => updateUnit(group, index, null)}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-[10px] text-slate-400 hover:text-red-400"
          title="Quitar"
        >
          ×
        </button>
        <button
          onClick={() => setEditing({ kind: "unit", group, index })}
          className="flex flex-col items-center gap-1"
        >
          {entity?.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entity.iconUrl} alt={entity.name} className="h-12 w-12 rounded-md object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-md bg-slate-700" />
          )}
          <span className="text-xs text-slate-200 text-center leading-tight">
            {entity?.name ?? unit.apiName}
          </span>
        </button>
        {!isPickup && <StarRating star={unit.star} onSet={(star) => setStar(group, index, star)} />}
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
        {board.rerollCost === 0 && (
          <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs font-medium text-emerald-300">
            Rerroll gratis
          </span>
        )}
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

      {boardTraits.length > 0 && (
        <>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Sinergias</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {boardTraits.map((t) => {
              const trait = traitByName.get(t.name);
              const isActive = t.tierCurrent > 0;
              const next = nextThreshold(t.name, t.numUnits);
              return (
                <div
                  key={t.name}
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${
                    isActive ? "bg-emerald-900/60" : "bg-slate-800"
                  }`}
                >
                  {trait?.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={trait.iconUrl}
                      alt={t.name}
                      className={`h-4 w-4 ${isActive ? "" : "opacity-40 grayscale"}`}
                    />
                  ) : null}
                  <span className={`text-xs ${isActive ? "text-emerald-300" : "text-slate-400"}`}>
                    {t.name} ({t.numUnits}{next != null ? `/${next}` : ""})
                  </span>
                </div>
              );
            })}
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
      <div className="mb-4 flex flex-wrap gap-2">
        {board.bench.map((unit, i) => renderUnit(unit, "bench", i))}
        {board.bench.length === 0 && <p className="text-sm text-slate-500">(vacía)</p>}
      </div>

      <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        Items sueltos
        <button onClick={() => setAdding("looseItems")} className="text-emerald-400 hover:text-emerald-300">
          + agregar
        </button>
      </p>
      <div className="flex flex-wrap gap-2">
        {looseItemGroups.map(({ apiName, count }) => {
          const item = itemByApiName.get(apiName);
          return (
            <div key={apiName} className="relative flex flex-col items-center gap-1 rounded-lg bg-slate-800 p-2 w-16">
              <button
                onClick={() => addLooseItemCopy(apiName)}
                className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white hover:bg-emerald-500"
                title="Agregar otra copia"
              >
                +
              </button>
              <button
                onClick={() => removeLooseItemCopy(apiName)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-[10px] text-slate-400 hover:text-red-400"
                title="Quitar una copia"
              >
                ×
              </button>
              <button onClick={() => setEditing({ kind: "looseItem", apiName })} className="flex flex-col items-center gap-1">
                {item?.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.iconUrl} alt={item.name} className="h-10 w-10 rounded-md object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-slate-700" />
                )}
                <span className="text-[10px] text-slate-200 text-center leading-tight">
                  {item?.name ?? apiName}
                </span>
              </button>
              {count > 1 && (
                <span className="rounded-full bg-slate-700 px-1.5 text-[10px] text-slate-200">×{count}</span>
              )}
            </div>
          );
        })}
        {looseItemGroups.length === 0 && <p className="text-sm text-slate-500">(ninguno)</p>}
      </div>

      {editing?.kind === "unit" && (
        <EntityPicker
          options={editing.group === "bench" ? [...pickupOptions, ...championOptions] : championOptions}
          placeholder="Buscar campeón..."
          onClose={() => setEditing(null)}
          onSelect={(apiName) => {
            const unit = board[editing.group][editing.index];
            updateUnit(editing.group, editing.index, { ...unit, apiName });
            setEditing(null);
          }}
        />
      )}

      {editing?.kind === "looseItem" && (
        <EntityPicker
          options={itemOptions}
          placeholder="Reemplazar una copia por..."
          onClose={() => setEditing(null)}
          onSelect={(apiName) => {
            replaceLooseItemCopy(editing.apiName, apiName);
            setEditing(null);
          }}
        />
      )}

      {(adding === "units" || adding === "bench") && (
        <EntityPicker
          options={adding === "bench" ? [...pickupOptions, ...championOptions] : championOptions}
          placeholder="Buscar campeón..."
          onClose={() => setAdding(null)}
          multi
          onConfirm={(apiNames) => addUnits(adding, apiNames)}
        />
      )}

      {adding === "looseItems" && (
        <EntityPicker
          options={itemOptions}
          placeholder="Buscar item..."
          onClose={() => setAdding(null)}
          multi
          allowQuantity
          onConfirm={addLooseItems}
        />
      )}
    </div>
  );
}
