import { NextResponse } from "next/server";
import { ACCOUNTS } from "@/lib/engine";

export async function GET() {
  const accounts = Object.entries(ACCOUNTS)
    .map(([number, info]) => ({ number, name: info.name, category: info.category }))
    .sort((a, b) => a.number.localeCompare(b.number));

  return NextResponse.json(accounts);
}
