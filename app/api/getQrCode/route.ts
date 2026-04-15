import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { getBearerToken, verifyBasicAuthToken } from "@/lib/auth";

type QrCodeRow = RowDataPacket & {
  product_name?: string | null;
  mrp?: number | string | null;
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
      `SELECT c.product_name, p.mrp, c.qr_code
       FROM coupons c
       LEFT JOIN products p ON p.id = c.product_id
       WHERE batch_id = ? 
       ORDER BY c.id ASC`,
      [batchId],
    );

    return NextResponse.json({
      success: true,
      data: rows.map((r) => {
        const productName =
          typeof r.product_name === "string" && r.product_name.trim()
            ? r.product_name.trim()
            : "";
        const qrCode =
          typeof r.qr_code === "string" && r.qr_code.trim()
            ? r.qr_code.trim()
            : null;
        const mrpRaw =
          typeof r.mrp === "number"
            ? String(r.mrp)
            : typeof r.mrp === "string"
              ? r.mrp.trim()
              : "";
        const mrpValue = mrpRaw ? `INR ${mrpRaw}` : "INR 0";

        return {
          PoductName: productName,
          MRP: mrpValue,
          ...(qrCode ? { QRCODE: qrCode } : {}),
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Unable to fetch QR codes" },
      { status: 500 },
    );
  }
}
