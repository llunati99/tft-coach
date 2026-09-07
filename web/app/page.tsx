"use client";

import { useEffect, useState } from "react";
import ScreenshotUploader from "@/components/ScreenshotUploader";
import BoardPreview from "@/components/BoardPreview";
import RecommendationPanel from "@/components/RecommendationPanel";
import WelcomeScreen from "@/components/WelcomeScreen";
import MatchHistoryPanel from "@/components/MatchHistoryPanel";
import type { TftGameData } from "@/lib/staticData";
import type { BoardReading, Recommendation } from "@/lib/anthropic";

export default function Home() {
  const [gameData, setGameData] = useState<TftGameData | null>(null);
  const [matchStarted, setMatchStarted] = useState(false);
  const [history, setHistory] = useState<BoardReading[]>([]);
  const [board, setBoard] = useState<BoardReading | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isAnalyzingScreenshot, setIsAnalyzingScreenshot] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    fetch("/api/game-data")
      .then((res) => res.json())
      .then(setGameData)
      .catch(() => setError("No se pudo cargar la data del juego (Community Dragon)."));
  }, []);

  function startMatch() {
    setMatchStarted(true);
    setHistory([]);
    setBoard(null);
    setRecommendation(null);
    setError(null);
  }

  function endMatch() {
    setMatchStarted(false);
    setHistory([]);
    setBoard(null);
    setRecommendation(null);
    setError(null);
  }

  function saveSnapshot() {
    if (!board) return;
    setHistory((prev) => [...prev, board]);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  function removeSnapshot(index: number) {
    setHistory((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload(file: File) {
    setError(null);
    setBoard(null);
    setRecommendation(null);
    setIsAnalyzingScreenshot(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/analyze-screenshot", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error leyendo la captura");
      setBoard(data.board);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error leyendo la captura");
    } finally {
      setIsAnalyzingScreenshot(false);
    }
  }

  async function handleAnalyze() {
    if (!board) return;
    setError(null);
    setIsRecommending(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando la recomendación");
      if (!data.recommendation?.shortAdvice) {
        throw new Error("La IA no devolvió una recomendación clara. Probá analizar de nuevo.");
      }
      setRecommendation(data.recommendation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando la recomendación");
    } finally {
      setIsRecommending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <main className="mx-auto flex max-w-2xl flex-col gap-6">
        {!matchStarted ? (
          <WelcomeScreen onStart={startMatch} />
        ) : (
          <>
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">TFT Coach</h1>
                <p className="text-sm text-slate-400">
                  Subí una captura, corregí si hace falta, y guardala en el historial para que la
                  IA vea cómo progresa tu partida.
                </p>
              </div>
              <button
                onClick={endMatch}
                className="whitespace-nowrap text-sm text-slate-400 hover:text-slate-200"
              >
                Terminar partida
              </button>
            </header>

            {error && (
              <div className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <ScreenshotUploader onUpload={handleUpload} isLoading={isAnalyzingScreenshot} />

            {board && gameData && (
              <>
                <BoardPreview board={board} gameData={gameData} onChange={setBoard} />
                <div className="flex gap-2">
                  <button
                    onClick={handleAnalyze}
                    disabled={isRecommending}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isRecommending ? "Analizando…" : "Analizar tablero"}
                  </button>
                  <button
                    onClick={saveSnapshot}
                    className="rounded-lg border border-slate-600 px-4 py-3 font-medium text-slate-200 transition hover:bg-slate-800"
                  >
                    {justSaved ? "Guardado ✓" : "Guardar captura"}
                  </button>
                </div>
              </>
            )}

            {recommendation && gameData && (
              <RecommendationPanel recommendation={recommendation} gameData={gameData} />
            )}

            {gameData && (
              <MatchHistoryPanel snapshots={history} gameData={gameData} onRemove={removeSnapshot} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
