"use client";

interface Props {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: Props) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <div>
        <h1 className="text-3xl font-bold text-white">TFT Coach</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          Andá guardando capturas de tu tablero a medida que jugás. La IA va a entender cómo
          evoluciona tu comp, items y sinergias a lo largo de la partida para darte mejores
          recomendaciones.
        </p>
      </div>
      <button
        onClick={onStart}
        className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-medium text-white transition hover:bg-emerald-500"
      >
        Empezar partida
      </button>
    </div>
  );
}
