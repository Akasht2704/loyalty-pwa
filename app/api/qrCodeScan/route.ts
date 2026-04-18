import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assignRoleForCouponBrand,
  creditPointsForScan,
} from "@/lib/qrscan/service";
import { reverseGeocodeNominatim } from "@/lib/reverse-geocode";

type CouponRow = RowDataPacket & {
  id?: number;
  brand_id?: number | null;
  qr_code?: string;
  product_name?: string;
  product_id?: number | null;
  category_id?: number | null;
  sub_category_id?: number | null;
  category_name?: string | null;
  sub_category_name?: string | null;
};

type ScanRequestBody = {
  qrcode?: string;
  scanState?: string;
  scanDistrict?: string;
  scanCity?: string;
  latitude?: number;
  longitude?: number;
  /** From client: `{ "qr_code": "<raw scanned value>" }` — stored in `scan_log.scan_data` even if coupon missing. */
  scan_data?: unknown;
};

function trimOpt(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function finiteCoord(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function optionalInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Persist only `{ qr_code }` from the frontend; fallback if missing or invalid. */
function scanDataJsonFromFrontend(
  body: ScanRequestBody,
  fallbackQrCode: string,
): string {
  const raw = body.scan_data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const qc = (raw as Record<string, unknown>).qr_code;
    if (typeof qc === "string" && qc.trim()) {
      return JSON.stringify({ qr_code: qc.trim() });
    }
  }
  return JSON.stringify({ qr_code: fallbackQrCode });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScanRequestBody;
    const rawCode = body.qrcode;
    if (!rawCode || typeof rawCode !== "string") {
      return NextResponse.json({ error: "QR code is required" }, { status: 400 });
    }

    const qrcode = rawCode.trim();

    const [couponRows] = await db.execute<CouponRow[]>(
      "SELECT * FROM coupons WHERE qr_code = ? LIMIT 1",
      [qrcode],
    );

    const bearer = getBearerToken(request);
    const auth = bearer ? verifyAuthToken(bearer) : null;
    let scanLogId: number | null = null;
    let scanState: string | null = null;
    let scanDistrict: string | null = null;
    let scanCity: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    let userRoleNameForLog = "";
    let roleIdForPoints = auth?.roleId ?? null;
    let roleNameForPoints = "";
    let brandIdForPoints = auth?.brandId ?? null;
    let scanLogStatus: "inserted" | "skipped_not_authenticated" | "failed" =
      auth ? "failed" : "skipped_not_authenticated";
    let scanLogError: string | undefined;
    let pointsMessage: string | undefined;
    let pointsEarnedValue: number | undefined;

    if (auth) {
      try {
        scanState = trimOpt(body.scanState);
        scanDistrict = trimOpt(body.scanDistrict);
        scanCity = trimOpt(body.scanCity);
        latitude = finiteCoord(body.latitude); 
        longitude = finiteCoord(body.longitude);

        const needGeocode =
          latitude != null &&
          longitude != null &&
          (!scanState || !scanDistrict || !scanCity);

        if (needGeocode && latitude != null && longitude != null) {
          const geo = await reverseGeocodeNominatim(latitude, longitude);
          if (!scanState && geo.scanState) scanState = geo.scanState;
          if (!scanDistrict && geo.scanDistrict) scanDistrict = geo.scanDistrict;
          if (!scanCity && geo.scanCity) scanCity = geo.scanCity;
        }

        const [roleNameRows] = await db.execute<RowDataPacket[]>(
          "SELECT name FROM roles WHERE id = ? LIMIT 1",
          [auth.roleId],
        );
        userRoleNameForLog = String(roleNameRows[0]?.name ?? "");
        roleNameForPoints = userRoleNameForLog;

        const c = couponRows[0];
        const brandIdLog = c ? optionalInt(c.brand_id) : null;
        const productId = c ? optionalInt(c.product_id) : null;
        const productName =
          c &&
          typeof c.product_name === "string" &&
          c.product_name.trim()
            ? c.product_name.trim()
            : null;
        const categoryId = c ? optionalInt(c.category_id) : null;
        const subCategoryId = c ? optionalInt(c.sub_category_id) : null;

        const scanDataJson = scanDataJsonFromFrontend(body, qrcode);

        const [scanLogHeader] = await db.execute<ResultSetHeader>(
          `INSERT INTO scan_log (
            user_id, qr_code, user_name, user_phone, user_role_id, user_role_name,
            scan_state, scan_district, scan_city, app_id, scan_data, brand_id,
            longitude, latitude, product_id, product_name, category_id, sub_category_id
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            auth.userId,
            qrcode,
            auth.name,
            auth.phone,
            auth.roleId,
            userRoleNameForLog,
            scanState,
            scanDistrict,
            scanCity,
            auth.appId,
            scanDataJson,
            brandIdLog,
            longitude,
            latitude,
            productId,
            productName,
            categoryId,
            subCategoryId,
          ],
        );
        scanLogId = scanLogHeader.insertId ? Number(scanLogHeader.insertId) : null;
        scanLogStatus = scanLogId ? "inserted" : "failed";
        if (!scanLogId) {
          scanLogError = "scan_log insert did not return insertId";
        }
      } catch (logErr) {
        console.error("scan_log insert failed:", logErr);
        scanLogStatus = "failed";
        scanLogError = (logErr as Error).message;
      }
    }

    if (couponRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Coupon not found",
        data: [],
        scanLogStatus,
        ...(scanLogError ? { scanLogError } : {}),
      });
    }

    const coupon = couponRows[0];

    let newToken: string | undefined;
    let sessionUser:
      | {
          userId: number;
          name: string;
          phone: string;
          appId: number;
          roleId: number;
          brandId: number | null;
        }
      | undefined;

    if (auth) {
      const phone = auth.phone.trim();
      if (phone) {
        const roleAssignment = await assignRoleForCouponBrand({
          auth,
          coupon,
          initialRoleIdForPoints: roleIdForPoints,
          initialBrandIdForPoints: brandIdForPoints,
          initialRoleNameForPoints: roleNameForPoints,
        });
        roleIdForPoints = roleAssignment.roleIdForPoints;
        roleNameForPoints = roleAssignment.roleNameForPoints;
        brandIdForPoints = roleAssignment.brandIdForPoints;
        newToken = roleAssignment.newToken;
        sessionUser = roleAssignment.sessionUser;
      }
    }

    if (auth && scanLogId && couponRows.length > 0) {
      const pointsResult = await creditPointsForScan({
        auth,
        scanLogId,
        coupon: couponRows[0],
        qrcode,
        roleIdForPoints,
        roleNameForPoints,
        brandIdForPoints,
        scanState,
        scanDistrict,
        scanCity,
        userRoleNameForLog,
      });
      if (pointsResult.pointsMessage) {
        pointsMessage = pointsResult.pointsMessage;
      }
      if (pointsResult.pointsEarnedValue != null) {
        pointsEarnedValue = pointsResult.pointsEarnedValue;
      }
    }

    return NextResponse.json({
      success: true,
      data: couponRows,
      scanLogStatus,
      ...(scanLogError ? { scanLogError } : {}),
      ...(pointsMessage ? { pointsMessage } : {}),
      ...(pointsEarnedValue != null ? { pointsEarned: pointsEarnedValue } : {}),
      ...(newToken && sessionUser
        ? { newToken, user: sessionUser }
        : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
