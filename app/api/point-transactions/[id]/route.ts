import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";

type PointTxnRow = RowDataPacket & {
  id?: number;
  scan_log_id?: number | null;
  coupon_id?: number | null;
  qr_code?: string | null;
  user_id?: number | null;
  user_name?: string | null;
  user_phone?: string | null;
  user_role_id?: number | null;
  user_role_name?: string | null;
  scan_state?: string | null;
  scan_district?: string | null;
  scan_city?: string | null;
  app_id?: number | null;
  brand_id?: number | null;
  category_id?: number | null;
  category_name?: string | null;
  sub_category_id?: number | null;
  sub_category_name?: string | null;
  product_id?: number | null;
  product_name?: string | null;
  scheme_detail_id?: number | null;
  points_earned?: number | string | null;
  point_expiry_date?: string | Date | null;
  created_at?: Date | string | null;
};

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const dateStr = (v: unknown): string | null => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 10);
  return null;
};

const isoMaybe = (v: unknown): string | null => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const bearer = getBearerToken(request);
    const auth = bearer ? verifyAuthToken(bearer) : null;
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
    }

    const [rows] = await db.execute<PointTxnRow[]>(
      `SELECT
        t.id,
        t.scan_log_id,
        t.coupon_id,
        t.qr_code,
        t.user_id,
        t.user_name,
        t.user_phone,
        t.user_role_id,
        t.user_role_name,
        t.scan_state,
        t.scan_district,
        t.scan_city,
        t.app_id,
        t.brand_id,
        t.category_id,
        t.category_name,
        t.sub_category_id,
        t.sub_category_name,
        t.product_id,
        t.product_name,
        t.scheme_detail_id,
        t.points_earned,
        t.point_expiry_date,
        t.created_at
      FROM point_in_txn t
      WHERE t.id = ? AND t.user_id = ? AND t.app_id = ?
      LIMIT 1`,
      [id, auth.userId, auth.appId],
    );

    const row = rows[0];
    if (!row?.id) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: Number(row.id),
        scanLogId: toNumber(row.scan_log_id),
        couponId: toNumber(row.coupon_id),
        qrCode: typeof row.qr_code === "string" ? row.qr_code : "",
        userName: str(row.user_name) ?? "",
        userPhone: str(row.user_phone) ?? "",
        userRoleId: toNumber(row.user_role_id),
        userRoleName: str(row.user_role_name),
        scanState: str(row.scan_state),
        scanDistrict: str(row.scan_district),
        scanCity: str(row.scan_city),
        brandId: toNumber(row.brand_id),
        categoryId: toNumber(row.category_id),
        categoryName: str(row.category_name),
        subCategoryId: toNumber(row.sub_category_id),
        subCategoryName: str(row.sub_category_name),
        productId: toNumber(row.product_id),
        productName: str(row.product_name),
        schemeDetailId: toNumber(row.scheme_detail_id),
        pointsEarned: toNumber(row.points_earned),
        pointExpiryDate: dateStr(row.point_expiry_date),
        createdAt: isoMaybe(row.created_at),
      },
    });
  } catch (error) {
    const msg = (error as Error).message;
    const code = (error as { code?: string }).code;
    if (code === "ER_BAD_FIELD_ERROR" && msg.includes("created_at")) {
      return NextResponse.json(
        {
          error:
            "Database column `created_at` is missing on `point_in_txn`. Add TIMESTAMP DEFAULT CURRENT_TIMESTAMP.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg || "Failed to load transaction" }, { status: 500 });
  }
}
