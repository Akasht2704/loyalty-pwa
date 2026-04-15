import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { getBearerToken, verifyBasicAuthToken } from "@/lib/auth";

type QrCodeRow = RowDataPacket & {
  qr_code?: string;
};

const toIntOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

export async function POST(request: NextRequest) {
  try {
    const bearer = getBearerToken(request);
    const auth = bearer ? verifyBasicAuthToken(bearer) : null;
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing token" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const batchId = toIntOrNull(body?.batch_id ?? body?.batchId);

    if (batchId == null) {
      return NextResponse.json(
        { success: false, error: "batch_id is required" },
        { status: 400 },
      );
    }

    const [rows] = await db.execute<QrCodeRow[]>(
      `SELECT qr_code
       FROM coupons
       WHERE batch_id = ? 
       ORDER BY id ASC`,
      [batchId],
    );

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      qr_codes: rows
        .map((r) => (typeof r.qr_code === "string" ? r.qr_code : ""))
        .filter((v) => v.length > 0),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Unable to fetch QR codes" },
      { status: 500 },
    );
  }
}
