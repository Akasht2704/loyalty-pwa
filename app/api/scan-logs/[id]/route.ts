import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";

type ScanLogDetailRow = RowDataPacket & {
  id?: number;
  qr_code?: string | null;
  user_name?: string | null;
  user_phone?: string | null;
  user_role_name?: string | null;
  scan_state?: string | null;
  scan_district?: string | null;
  scan_city?: string | null;
  brand_id?: number | null;
  longitude?: number | string | null;
  latitude?: number | string | null;
  product_id?: number | null;
  scan_product_name?: string | null;
  scan_category_id?: number | null;
  scan_sub_category_id?: number | null;
  scan_data?: string | null;
  created_at?: Date | string | null;
  coupon_product_name?: string | null;
  coupon_category_name?: string | null;
  coupon_sub_category_name?: string | null;
  product_mrp?: number | string | null;
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
      return NextResponse.json({ error: "Invalid scan id" }, { status: 400 });
    }

    const [rows] = await db.execute<ScanLogDetailRow[]>(
      `SELECT
        sl.id,
        sl.qr_code,
        sl.user_name,
        sl.user_phone,
        sl.user_role_name,
        sl.scan_state,
        sl.scan_district,
        sl.scan_city,
        sl.brand_id,
        sl.longitude,
        sl.latitude,
        sl.product_id,
        sl.product_name AS scan_product_name,
        sl.category_id AS scan_category_id,
        sl.sub_category_id AS scan_sub_category_id,
        sl.scan_data,
        sl.created_at,
        c.product_name AS coupon_product_name,
        c.category_name AS coupon_category_name,
        c.sub_category_name AS coupon_sub_category_name,
        p.mrp AS product_mrp
      FROM scan_log sl
      LEFT JOIN coupons c ON c.qr_code = sl.qr_code
      LEFT JOIN products p ON p.id = COALESCE(
        NULLIF(sl.product_id, 0),
        NULLIF(c.product_id, 0)
      )
      WHERE sl.id = ? AND sl.user_id = ? AND sl.app_id = ?
      LIMIT 1`,
      [id, auth.userId, auth.appId],
    );

    const row = rows[0];
    if (!row?.id) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    let scanDataParsed: unknown = null;
    const rawScan = row.scan_data;
    if (typeof rawScan === "string" && rawScan.trim()) {
      try {
        scanDataParsed = JSON.parse(rawScan) as unknown;
      } catch {
        scanDataParsed = rawScan;
      }
    }

    const mrpRaw = row.product_mrp;
    const mrpNum =
      typeof mrpRaw === "number" && Number.isFinite(mrpRaw)
        ? mrpRaw
        : typeof mrpRaw === "string" && mrpRaw.trim() !== "" && Number.isFinite(Number(mrpRaw))
          ? Number(mrpRaw)
          : null;

    const productName =
      (typeof row.coupon_product_name === "string" && row.coupon_product_name.trim()
        ? row.coupon_product_name.trim()
        : null) ??
      (typeof row.scan_product_name === "string" && row.scan_product_name.trim()
        ? row.scan_product_name.trim()
        : null);

    return NextResponse.json({
      success: true,
      data: {
        id: Number(row.id),
        qrCode: typeof row.qr_code === "string" ? row.qr_code : "",
        userName: typeof row.user_name === "string" ? row.user_name : "",
        userPhone: typeof row.user_phone === "string" ? row.user_phone : "",
        userRoleName:
          typeof row.user_role_name === "string" && row.user_role_name.trim()
            ? row.user_role_name.trim()
            : null,
        scanState:
          typeof row.scan_state === "string" && row.scan_state.trim()
            ? row.scan_state.trim()
            : null,
        scanDistrict:
          typeof row.scan_district === "string" && row.scan_district.trim()
            ? row.scan_district.trim()
            : null,
        scanCity:
          typeof row.scan_city === "string" && row.scan_city.trim()
            ? row.scan_city.trim()
            : null,
        brandId: row.brand_id != null ? Number(row.brand_id) : null,
        longitude: row.longitude != null ? Number(row.longitude) : null,
        latitude: row.latitude != null ? Number(row.latitude) : null,
        productId: row.product_id != null ? Number(row.product_id) : null,
        productName,
        categoryName:
          typeof row.coupon_category_name === "string" && row.coupon_category_name.trim()
            ? row.coupon_category_name.trim()
            : null,
        subCategoryName:
          typeof row.coupon_sub_category_name === "string" &&
          row.coupon_sub_category_name.trim()
            ? row.coupon_sub_category_name.trim()
            : null,
        mrp: mrpNum,
        scanCategoryId:
          row.scan_category_id != null ? Number(row.scan_category_id) : null,
        scanSubCategoryId:
          row.scan_sub_category_id != null ? Number(row.scan_sub_category_id) : null,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : typeof row.created_at === "string"
              ? row.created_at
              : null,
        scanData: scanDataParsed,
      },
    });
  } catch (error) {
    const msg = (error as Error).message;
    const code = (error as { code?: string }).code;
    if (code === "ER_BAD_FIELD_ERROR" && msg.includes("created_at")) {
      return NextResponse.json(
        {
          error:
            "Database column `created_at` is missing on `scan_log`. Add TIMESTAMP DEFAULT CURRENT_TIMESTAMP to enable details.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg || "Failed to load scan" }, { status: 500 });
  }
}
