import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";

type PointTxnListRow = RowDataPacket & {
  id?: number;
  qr_code?: string | null;
  points_earned?: number | string | null;
  created_at?: Date | string | null;
};

const dateOnly = (raw: string | null): string | null => {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
};

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET(request: NextRequest) {
  try {
    const bearer = getBearerToken(request);
    const auth = bearer ? verifyAuthToken(bearer) : null;
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = dateOnly(searchParams.get("from"));
    const to = dateOnly(searchParams.get("to"));

    let sql = `
      SELECT t.id, t.qr_code, t.points_earned, t.created_at
      FROM point_in_txn t
      WHERE t.user_id = ? AND t.app_id = ?
    `;
    const params: unknown[] = [auth.userId, auth.appId];

    if (from && to) {
      sql += ` AND DATE(t.created_at) >= ? AND DATE(t.created_at) <= ?`;
      params.push(from, to);
    }

    sql += ` ORDER BY t.id DESC LIMIT 300`;

    const [rows] = await db.execute<PointTxnListRow[]>(sql, params);

    const items = rows.map((r) => ({
      id: Number(r.id),
      qrCode: typeof r.qr_code === "string" ? r.qr_code : "",
      pointsEarned: toNumber(r.points_earned),
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : typeof r.created_at === "string"
            ? r.created_at
            : null,
    }));

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    const msg = (error as Error).message;
    const code = (error as { code?: string }).code;
    if (code === "ER_BAD_FIELD_ERROR" && msg.includes("created_at")) {
      return NextResponse.json(
        {
          error:
            "Database column `created_at` is missing on `point_in_txn`. Add TIMESTAMP DEFAULT CURRENT_TIMESTAMP to enable date filters.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: msg || "Failed to load point transactions" },
      { status: 500 },
    );
  }
}
