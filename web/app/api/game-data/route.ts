import { NextResponse } from "next/server";
import { getTftGameData } from "@/lib/staticData";

export async function GET() {
  const data = await getTftGameData();
  return NextResponse.json(data);
}
