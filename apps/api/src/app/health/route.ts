import { NextResponse } from "next/server";
import { HealthService } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await HealthService.getHealthStatus();
  return NextResponse.json(health);
}
