import type { HealthResponse } from "@downtown/types";
import { checkDatabaseConnection } from "@/db";

export class HealthService {
  static async getHealthStatus(): Promise<HealthResponse> {
    const dbConnected = await checkDatabaseConnection();

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "downtown-api",
      version: "0.0.1",
      database: {
        connected: dbConnected,
      },
    };
  }
}
