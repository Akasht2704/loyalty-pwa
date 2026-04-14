import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getBearerToken, signAuthToken, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { reverseGeocodeNominatim } from "@/lib/reverse-geocode";

type CouponRow = RowDataPacket & {
  brand_id?: number | null;
  qr_code?: string;
  product_name?: string;
  product_id?: number | null;
  category_id?: number | null;
  sub_category_id?: number | null;
};

type RoleRow = RowDataPacket & {
  role_id?: number;
  name?: string;
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

    if (auth) {
      try {
        let scanState = trimOpt(body.scanState);
        let scanDistrict = trimOpt(body.scanDistrict);
        let scanCity = trimOpt(body.scanCity);
        const latitude = finiteCoord(body.latitude);
        const longitude = finiteCoord(body.longitude);

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
        const userRoleName = String(roleNameRows[0]?.name ?? "");

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

        await db.execute(
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
            userRoleName,
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
      } catch (logErr) {
        console.error("scan_log insert failed:", logErr);
      }
    }

    if (couponRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Coupon not found",
        data: [],
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

    return NextResponse.json({
      success: true,
      data: couponRows,
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
