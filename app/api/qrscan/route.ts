import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getBearerToken, signAuthToken, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";
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

type RoleRow = RowDataPacket & {
  role_id?: number;
  name?: string;
};

type ProductRow = RowDataPacket & {
  scheme_id?: number | null;
  category_id?: number | null;
  sub_category_id?: number | null;
};

type SchemeDetailRow = RowDataPacket & {
  scheme_detail_id?: number;
  role_id?: number | null;
  value?: number | string | null;
  expiry_days?: number | string | null;
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

function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function expiryDateFromDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, Math.trunc(days)));
  return d.toISOString().slice(0, 10);
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
      const userId = auth.userId;
      const appId = auth.appId;
      const phone = auth.phone.trim();

      if (phone) {
        const brandRaw = coupon.brand_id;
        const brandId =
          brandRaw != null && Number.isFinite(Number(brandRaw))
            ? Number(brandRaw)
            : null;

        if (brandId != null) {
          const [roleRows] = await db.execute<RoleRow[]>(
            "SELECT id AS role_id, name FROM roles WHERE is_default = TRUE AND brand_id = ? LIMIT 1",
            [brandId],
          );

          const role = roleRows[0];
          if (role?.role_id != null && role.name) {
            const roleId = role.role_id;
            const roleName = role.name;
              roleIdForPoints = roleId;
              roleNameForPoints = roleName;
              brandIdForPoints = brandId;

            const [updateHeader] = await db.execute<ResultSetHeader>(
              "UPDATE user_roles SET role_id = ?, role_name = ?, brand_id = ? WHERE user_id = ? AND app_id = ? AND brand_id IS NULL",
              [roleId, roleName, brandId, userId, appId],
            );

            if (updateHeader.affectedRows === 0) {
              const [already] = await db.execute<RowDataPacket[]>(
                "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND app_id = ? AND role_id = ? AND brand_id = ? LIMIT 1",
                [userId, appId, roleId, brandId],
              );
              if (already.length === 0) {
                await db.execute(
                  "INSERT INTO user_roles (user_id, app_id, role_id, role_name, brand_id) VALUES (?, ?, ?, ?, ?)",
                  [userId, appId, roleId, roleName, brandId],
                );
              }
            }

            newToken = signAuthToken({
              userId,
              name: auth.name,
              phone,
              appId,
              roleId,
              brandId,
            });

            sessionUser = {
              userId,
              name: auth.name,
              phone,
              appId,
              roleId,
              brandId,
            };
          }
        }
      }
    }

    if (auth && scanLogId && couponRows.length > 0) {
      try {
        const coupon = couponRows[0];
        const couponId = optionalInt(coupon.id);
        const couponProductId = optionalInt(coupon.product_id);
        const fallbackCategoryId = optionalInt(coupon.category_id);
        const fallbackSubCategoryId = optionalInt(coupon.sub_category_id);
        const fallbackCategoryName =
          typeof coupon.category_name === "string" ? coupon.category_name : null;
        const fallbackSubCategoryName =
          typeof coupon.sub_category_name === "string" ? coupon.sub_category_name : null;
        const productName =
          typeof coupon.product_name === "string" ? coupon.product_name : null;

        let schemeId: number | null = null;
        let categoryId: number | null = fallbackCategoryId;
        let subCategoryId: number | null = fallbackSubCategoryId;
        let categoryName: string | null = fallbackCategoryName;
        let subCategoryName: string | null = fallbackSubCategoryName;

        if (couponProductId != null) {
          const [productRows] = await db.execute<ProductRow[]>(
            `SELECT scheme_id, category_id, sub_category_id
             FROM products
             WHERE id = ?
             LIMIT 1`,
            [couponProductId],
          );
          const product = productRows[0];
          schemeId = optionalInt(product?.scheme_id);
          categoryId = optionalInt(product?.category_id) ?? categoryId;
          subCategoryId = optionalInt(product?.sub_category_id) ?? subCategoryId;
        }

        if (schemeId != null && roleIdForPoints != null) {
          const [alreadyPointRows] = await db.execute<RowDataPacket[]>(
            "SELECT 1 AS ok FROM point_in_txn WHERE qr_code = ? AND user_role_id = ? LIMIT 1",
            [qrcode, roleIdForPoints],
          );
          if (alreadyPointRows.length > 0) {
            pointsMessage = "This QR is already scanned for this role";
          } else {
          const pointsBrandId = optionalInt(coupon.brand_id) ?? brandIdForPoints;
          const [schemeDetailRows] =
            pointsBrandId != null
              ? await db.execute<SchemeDetailRow[]>(
                  `SELECT id AS scheme_detail_id, role_id, value, expiry_days
                   FROM scheme_details
                   WHERE scheme_id = ? AND brand_id = ? AND role_id = ?
                   LIMIT 1`,
                  [schemeId, pointsBrandId, roleIdForPoints],
                )
              : await db.execute<SchemeDetailRow[]>(
                  `SELECT id AS scheme_detail_id, role_id, value, expiry_days
                   FROM scheme_details
                   WHERE scheme_id = ? AND role_id = ?
                   LIMIT 1`,
                  [schemeId, roleIdForPoints],
                );
          const schemeDetail = schemeDetailRows[0];
          const schemeDetailId = optionalInt(schemeDetail?.scheme_detail_id);
          const pointsEarned = optionalNumber(schemeDetail?.value);
          const expiryDays = optionalInt(schemeDetail?.expiry_days) ?? 0;

          if (
            schemeDetailId != null &&
            pointsEarned != null &&
            pointsEarned > 0
          ) {
            const pointExpiryDate = expiryDateFromDays(expiryDays);
            await db.execute(
              `INSERT INTO point_in_txn (
                scan_log_id, coupon_id, qr_code, user_id, user_name, user_phone,
                user_role_id, user_role_name, scan_state, scan_district, scan_city,
                app_id, brand_id, category_id, category_name, sub_category_id,
                sub_category_name, product_id, product_name, scheme_detail_id,
                points_earned, point_expiry_date
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              [
                scanLogId,
                couponId,
                qrcode,
                auth.userId,
                auth.name,
                auth.phone,
                roleIdForPoints ?? auth.roleId,
                roleNameForPoints || userRoleNameForLog,
                scanState,
                scanDistrict,
                scanCity,
                auth.appId,
                brandIdForPoints,
                categoryId,
                categoryName,
                subCategoryId,
                subCategoryName,
                couponProductId,
                productName,
                schemeDetailId,
                pointsEarned,
                pointExpiryDate,
              ],
            );
            pointsMessage = `Points credited: ${pointsEarned}`;
            pointsEarnedValue = pointsEarned;
          }
          }
        }
      } catch (pointsErr) {
        console.error("point_in_txn insert failed:", pointsErr);
        const msg = (pointsErr as { code?: string; message?: string })?.code;
        if (msg === "ER_DUP_ENTRY") {
          pointsMessage = "This QR is already scanned for this role";
        }
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
