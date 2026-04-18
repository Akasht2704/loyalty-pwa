import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";

type ScanLogListRow = RowDataPacket & {
  id?: number;
  qr_code?: string | null;
  product_name?: string | null;
  user_role_name?: string | null;
  scan_state?: string | null;
  created_at?: Date | string | null;
};

const dateOnly = (raw: string | null): string | null => {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
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
      SELECT
        sl.id,
        sl.qr_code,
        sl.product_name,
        sl.user_role_name,
        sl.scan_state,
        sl.created_at
      FROM scan_log sl
      WHERE sl.user_id = ? AND sl.app_id = ?
    `;
    const params: unknown[] = [auth.userId, auth.appId];

    if (from && to) {
      sql += ` AND DATE(sl.created_at) >= ? AND DATE(sl.created_at) <= ?`;
      params.push(from, to);
    }

    sql += ` ORDER BY sl.id DESC LIMIT 300`;

    const [rows] = await db.execute<ScanLogListRow[]>(sql, params);

    const items = rows.map((r) => ({
      id: Number(r.id),
      qrCode: typeof r.qr_code === "string" ? r.qr_code : "",
      productName:
        typeof r.product_name === "string" && r.product_name.trim()
          ? r.product_name.trim()
          : null,
      userRoleName:
        typeof r.user_role_name === "string" && r.user_role_name.trim()
          ? r.user_role_name.trim()
          : null,
      scanState:
        typeof r.scan_state === "string" && r.scan_state.trim()
          ? r.scan_state.trim()
          : null,
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
            "Database column `created_at` is missing on `scan_log`. Add it (e.g. TIMESTAMP DEFAULT CURRENT_TIMESTAMP) to enable listing and date filters.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg || "Failed to load scan logs" }, { status: 500 });
  }
}
