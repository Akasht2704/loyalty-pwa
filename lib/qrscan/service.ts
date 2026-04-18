import type { AuthJwtPayload } from "@/lib/auth";
import { signAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { reverseGeocodeNominatim } from "@/lib/reverse-geocode";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  expiryDateFromDays,
  finiteCoord,
  optionalInt,
  optionalNumber,
  parseRoleIdsFromLoyaltySequence,
  scanDataJsonFromFrontend,
  trimOpt,
  type ScanRequestBody,
} from "@/lib/qrscan/helpers";

export type CouponRow = RowDataPacket & {
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
  loyalty_sequence?: string | { role_id?: unknown } | null;
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

export type ScanLogResult = {
  scanLogId: number | null;
  scanState: string | null;
  scanDistrict: string | null;
  scanCity: string | null;
  userRoleNameForLog: string;
  scanLogStatus: "inserted" | "skipped_not_authenticated" | "failed";
  scanLogError?: string;
};

export type RoleAssignmentResult = {
  roleIdForPoints: number | null;
  roleNameForPoints: string;
  brandIdForPoints: number | null;
  newToken?: string;
  sessionUser?: {
    userId: number;
    name: string;
    phone: string;
    appId: number;
    roleId: number;
    brandId: number | null;
  };
};

export type PointsResult = {
  pointsMessage?: string;
  pointsEarnedValue?: number;
};

export async function getCouponRowsByQrCode(qrcode: string): Promise<CouponRow[]> {
  const [couponRows] = await db.execute<CouponRow[]>(
    "SELECT * FROM coupons WHERE qr_code = ? LIMIT 1",
    [qrcode],
  );
  return couponRows;
}

export async function insertScanLogIfAuthenticated(params: {
  auth: AuthJwtPayload | null;
  body: ScanRequestBody;
  qrcode: string;
  couponRows: CouponRow[];
}): Promise<ScanLogResult> {
  const { auth, body, qrcode, couponRows } = params;
  if (!auth) {
    return {
      scanLogId: null,
      scanState: null,
      scanDistrict: null,
      scanCity: null,
      userRoleNameForLog: "",
      scanLogStatus: "skipped_not_authenticated",
    };
  }

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

  try {
    const [roleNameRows] = await db.execute<RowDataPacket[]>(
      "SELECT name FROM roles WHERE id = ? LIMIT 1",
      [auth.roleId],
    );
    const userRoleNameForLog = String(roleNameRows[0]?.name ?? "");

    const c = couponRows[0];
    const brandIdLog = c ? optionalInt(c.brand_id) : null;
    const productId = c ? optionalInt(c.product_id) : null;
    const productName =
      c && typeof c.product_name === "string" && c.product_name.trim()
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

    const scanLogId = scanLogHeader.insertId ? Number(scanLogHeader.insertId) : null;
    return {
      scanLogId,
      scanState,
      scanDistrict,
      scanCity,
      userRoleNameForLog,
      scanLogStatus: scanLogId ? "inserted" : "failed",
      ...(scanLogId ? {} : { scanLogError: "scan_log insert did not return insertId" }),
    };
  } catch (error) {
    console.error("scan_log insert failed:", error);
    return {
      scanLogId: null,
      scanState,
      scanDistrict,
      scanCity,
      userRoleNameForLog: "",
      scanLogStatus: "failed",
      scanLogError: (error as Error).message,
    };
  }
}

export async function assignRoleForCouponBrand(params: {
  auth: AuthJwtPayload | null;
  coupon: CouponRow;
  initialRoleIdForPoints: number | null;
  initialBrandIdForPoints: number | null;
  initialRoleNameForPoints: string;
}): Promise<RoleAssignmentResult> {
  const {
    auth,
    coupon,
    initialRoleIdForPoints,
    initialBrandIdForPoints,
    initialRoleNameForPoints,
  } = params;

  let roleIdForPoints = initialRoleIdForPoints;
  let roleNameForPoints = initialRoleNameForPoints;
  let brandIdForPoints = initialBrandIdForPoints;
  let newToken: string | undefined;
  let sessionUser: RoleAssignmentResult["sessionUser"];

  if (!auth) {
    return { roleIdForPoints, roleNameForPoints, brandIdForPoints };
  }

  const phone = auth.phone.trim();
  if (!phone) {
    return { roleIdForPoints, roleNameForPoints, brandIdForPoints };
  }

  const brandRaw = coupon.brand_id;
  const brandId =
    brandRaw != null && Number.isFinite(Number(brandRaw)) ? Number(brandRaw) : null;
  if (brandId == null) {
    return { roleIdForPoints, roleNameForPoints, brandIdForPoints };
  }

  const [roleRows] = await db.execute<RoleRow[]>(
    "SELECT id AS role_id, name FROM roles WHERE is_default = TRUE AND brand_id = ? LIMIT 1",
    [brandId],
  );
  const role = roleRows[0];
  if (role?.role_id == null || !role.name) {
    return { roleIdForPoints, roleNameForPoints, brandIdForPoints };
  }

  roleIdForPoints = role.role_id;
  roleNameForPoints = role.name;
  brandIdForPoints = brandId;

  const [updateHeader] = await db.execute<ResultSetHeader>(
    "UPDATE user_roles SET role_id = ?, role_name = ?, brand_id = ? WHERE user_id = ? AND app_id = ? AND brand_id IS NULL",
    [role.role_id, role.name, brandId, auth.userId, auth.appId],
  );
  if (updateHeader.affectedRows === 0) {
    const [already] = await db.execute<RowDataPacket[]>(
      "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND app_id = ? AND role_id = ? AND brand_id = ? LIMIT 1",
      [auth.userId, auth.appId, role.role_id, brandId],
    );
    if (already.length === 0) {
      await db.execute(
        "INSERT INTO user_roles (user_id, app_id, role_id, role_name, brand_id) VALUES (?, ?, ?, ?, ?)",
        [auth.userId, auth.appId, role.role_id, role.name, brandId],
      );
    }
  }

  newToken = signAuthToken({
    userId: auth.userId,
    name: auth.name,
    phone,
    appId: auth.appId,
    roleId: role.role_id,
    brandId,
  });
  sessionUser = {
    userId: auth.userId,
    name: auth.name,
    phone,
    appId: auth.appId,
    roleId: role.role_id,
    brandId,
  };

  return { roleIdForPoints, roleNameForPoints, brandIdForPoints, newToken, sessionUser };
}

export async function creditPointsForScan(params: {
  auth: AuthJwtPayload | null;
  scanLogId: number | null;
  coupon: CouponRow;
  qrcode: string;
  roleIdForPoints: number | null;
  roleNameForPoints: string;
  brandIdForPoints: number | null;
  scanState: string | null;
  scanDistrict: string | null;
  scanCity: string | null;
  userRoleNameForLog: string;
}): Promise<PointsResult> {
  const {
    auth,
    scanLogId,
    coupon,
    qrcode,
    roleIdForPoints,
    roleNameForPoints,
    brandIdForPoints,
    scanState,
    scanDistrict,
    scanCity,
    userRoleNameForLog,
  } = params;

  if (!auth || !scanLogId || roleIdForPoints == null) return {};

  try {
    const couponId = optionalInt(coupon.id);
    const couponProductId = optionalInt(coupon.product_id);
    const fallbackCategoryId = optionalInt(coupon.category_id);
    const fallbackSubCategoryId = optionalInt(coupon.sub_category_id);
    const fallbackCategoryName =
      typeof coupon.category_name === "string" ? coupon.category_name : null;
    const fallbackSubCategoryName =
      typeof coupon.sub_category_name === "string" ? coupon.sub_category_name : null;
    const productName = typeof coupon.product_name === "string" ? coupon.product_name : null;

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

    if (schemeId == null) return {};

    const [alreadyPointRows] = await db.execute<RowDataPacket[]>(
      "SELECT 1 AS ok FROM point_in_txn WHERE qr_code = ? AND user_role_id = ? LIMIT 1",
      [qrcode, roleIdForPoints],
    );
    if (alreadyPointRows.length > 0) {
      return { pointsMessage: "This QR is already scanned for this role" };
    }

    const pointsBrandId = optionalInt(coupon.brand_id) ?? brandIdForPoints;
    const [currentRoleRows] = await db.execute<RoleRow[]>(
      "SELECT loyalty_sequence FROM roles WHERE id = ? LIMIT 1",
      [roleIdForPoints],
    );
    const currentRole = currentRoleRows[0];
    const allowedPriorRoleIds = parseRoleIdsFromLoyaltySequence(currentRole?.loyalty_sequence);

    const [priorScanRoleRows] =
      pointsBrandId != null
        ? await db.execute<RowDataPacket[]>(
            `SELECT DISTINCT user_role_id
             FROM point_in_txn
             WHERE qr_code = ? AND brand_id = ?`,
            [qrcode, pointsBrandId],
          )
        : await db.execute<RowDataPacket[]>(
            `SELECT DISTINCT user_role_id
             FROM point_in_txn
             WHERE qr_code = ?`,
            [qrcode],
          );
    const priorScanRoleIds = priorScanRoleRows
      .map((row) => optionalInt(row.user_role_id))
      .filter((id): id is number => id != null);
    const blockedByRoleSequence = priorScanRoleIds.some(
      (priorRoleId) => !allowedPriorRoleIds.includes(priorRoleId),
    );
    if (blockedByRoleSequence) {
      return { pointsMessage: "This QR is already scanned" };
    }

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

    if (schemeDetailId == null || pointsEarned == null || pointsEarned <= 0) return {};

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
        roleIdForPoints,
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

    return {
      pointsMessage: `Points credited: ${pointsEarned}`,
      pointsEarnedValue: pointsEarned,
    };
  } catch (pointsErr) {
    console.error("point_in_txn insert failed:", pointsErr);
    const msg = (pointsErr as { code?: string; message?: string })?.code;
    if (msg === "ER_DUP_ENTRY") {
      return { pointsMessage: "This QR is already scanned for this role" };
    }
    return {};
  }
}
