import { NextResponse } from "next/server";
import { getMasterData } from "@/src/lib/master-data-db";

export async function GET() {
  const masterData = await getMasterData();

  return NextResponse.json(masterData);
}
