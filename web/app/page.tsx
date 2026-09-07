"use client";

import { useEffect, useState } from "react";
import ScreenshotUploader from "@/components/ScreenshotUploader";
import BoardPreview from "@/components/BoardPreview";
import RecommendationPanel from "@/components/RecommendationPanel";
import type { TftGameData } from "@/lib/staticData";
import type { BoardReading, Recommendation } from "@/lib/anthropic";

export default function Home() {
  const [gameData, setGameData] = useState<TftGameData | null>(null);
  const [board, setBoard] = useState<BoardReading | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isAnalyzingScreenshot, setIsAnalyzingScreenshot] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/game-data")
      .then((res) => res.json())
      .then(setGameData)
      .catch(() => setError("No se pudo cargar la data del juego (Community Dragon)."));
  }, []);

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
        body: JSON.stringify({ board }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando la recomendación");
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
        <header>
          <h1 className="text-2xl font-bold text-white">TFT Coach</h1>
          <p className="text-sm text-slate-400">
            Subí una captura de tu tablero en vivo y recibí recomendaciones respaldadas por datos reales
            cuando existan, o razonamiento de IA cuando todavía no.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <ScreenshotUploader onUpload={handleUpload} isLoading={isAnalyzingScreenshot} />

        {board && gameData && (
          <>
            <BoardPreview board={board} gameData={gameData} />
            <button
              onClick={handleAnalyze}
              disabled={isRecommending}
              className="rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRecommending ? "Analizando…" : "Analizar tablero"}
            </button>
          </>
        )}

        {recommendation && gameData && (
          <RecommendationPanel recommendation={recommendation} gameData={gameData} />
        )}
      </main>
    </div>
  );
}
