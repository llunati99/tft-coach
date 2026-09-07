"use client";

import { useCallback, useRef, useState } from "react";

interface Props {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export default function ScreenshotUploader({ onUpload, isLoading }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setPreviewUrl(URL.createObjectURL(file));
      onUpload(file);
    },
    [onUpload]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-600 bg-slate-800/50 p-8 text-center transition hover:border-emerald-500 hover:bg-slate-800"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Captura subida" className="max-h-48 rounded-lg object-contain" />
      ) : (
        <>
          <span className="text-4xl">📸</span>
          <p className="text-slate-300">
            Subí, arrastrá o pegá (Ctrl+V) una captura de tu tablero de TFT
          </p>
        </>
      )}
      {isLoading && <p className="text-sm text-emerald-400">Leyendo el tablero…</p>}
    </div>
  );
}
