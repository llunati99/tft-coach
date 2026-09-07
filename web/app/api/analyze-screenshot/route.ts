import { NextResponse } from "next/server";
import { analyzeScreenshot } from "@/lib/anthropic";
import { formatGameDataForPrompt, getTftGameData } from "@/lib/staticData";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo de imagen ('image')." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Formato de imagen no soportado: ${file.type}` },
      { status: 400 }
    );
  }

  const gameData = await getTftGameData();
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  try {
    const board = await analyzeScreenshot(
      base64,
      file.type as "image/png" | "image/jpeg" | "image/webp",
      formatGameDataForPrompt(gameData)
    );
    return NextResponse.json({ board, setNumber: gameData.setNumber });
  } catch (error) {
    console.error("analyze-screenshot failed:", error);
    return NextResponse.json(
      { error: "No se pudo leer la captura. Probá con otra imagen más clara." },
      { status: 502 }
    );
  }
}
