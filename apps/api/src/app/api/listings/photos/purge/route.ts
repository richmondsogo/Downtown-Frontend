import { NextResponse } from "next/server";
import { list, del } from "@vercel/blob";
import { getBlobToken } from "../../../../../services/storage.service";
import { db } from "../../../../../db";
import { listingPhoto } from "../../../../../db/schema";
import { sql } from "drizzle-orm";

export async function POST() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }

  try {
    const token = getBlobToken();
    const { blobs } = await list({ token });
    for (const b of blobs) {
      await del(b.url, { token });
    }
    await db.delete(listingPhoto).where(sql`key LIKE 'listings/%'`);

    return NextResponse.json({ success: true, purged: blobs.length }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
