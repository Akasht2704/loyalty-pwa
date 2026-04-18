import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import {
  getBearerToken,
  type AuthJwtPayload,
  verifyAuthToken,
  verifyBasicAuthToken,
} from "@/lib/auth";
import { db } from "@/lib/db";
import type { ScanRequestBody } from "@/lib/qrscan/helpers";
import {
  assignRoleForCouponBrand,
  creditPointsForScan,
  getCouponRowsByQrCode,
  insertScanLogIfAuthenticated,
} from "@/lib/qrscan/service";

type UserIdentityRow = RowDataPacket & {
  name?: string;
  phone?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScanRequestBody;
    const rawCode = body.qrcode;
    if (!rawCode || typeof rawCode !== "string") {
      return NextResponse.json({ error: "QR code is required" }, { status: 400 });
    }

    const qrcode = rawCode.trim();

    const couponRows = await getCouponRowsByQrCode(qrcode);

    const bearer = getBearerToken(request);
    let auth: AuthJwtPayload | null = bearer ? verifyAuthToken(bearer) : null;
    if (!auth && bearer) {
      const basicAuth = verifyBasicAuthToken(bearer);
      if (basicAuth) {
        const [userRows] = await db.execute<UserIdentityRow[]>(
          "SELECT name, phone FROM users WHERE id = ? LIMIT 1",
          [basicAuth.userId],
        );
        const user = userRows[0];
        auth = {
          userId: basicAuth.userId,
          appId: basicAuth.appId,
          roleId: basicAuth.roleId,
          brandId: basicAuth.brandId,
          name: typeof user?.name === "string" ? user.name : "",
          phone: typeof user?.phone === "string" ? user.phone : "",
        };
      }
    }
    let roleIdForPoints = auth?.roleId ?? null;
    let roleNameForPoints = "";
    let brandIdForPoints = auth?.brandId ?? null;
    const scanLogResult = await insertScanLogIfAuthenticated({
      auth,
      body,
      qrcode,
      couponRows,
    });
    roleNameForPoints = scanLogResult.userRoleNameForLog;

    if (couponRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Coupon not found",
        data: [],
        scanLogStatus: scanLogResult.scanLogStatus,
        ...(scanLogResult.scanLogError ? { scanLogError: scanLogResult.scanLogError } : {}),
      });
    }

    const coupon = couponRows[0];
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

    const pointsResult = await creditPointsForScan({
      auth,
      scanLogId: scanLogResult.scanLogId,
      coupon,
      qrcode,
      roleIdForPoints,
      roleNameForPoints,
      brandIdForPoints,
      scanState: scanLogResult.scanState,
      scanDistrict: scanLogResult.scanDistrict,
      scanCity: scanLogResult.scanCity,
      userRoleNameForLog: scanLogResult.userRoleNameForLog,
    });

    return NextResponse.json({
      success: true,
      data: couponRows,
      scanLogStatus: scanLogResult.scanLogStatus,
      ...(scanLogResult.scanLogError ? { scanLogError: scanLogResult.scanLogError } : {}),
      ...(pointsResult.pointsMessage ? { pointsMessage: pointsResult.pointsMessage } : {}),
      ...(pointsResult.pointsEarnedValue != null
        ? { pointsEarned: pointsResult.pointsEarnedValue }
        : {}),
      ...(roleAssignment.newToken && roleAssignment.sessionUser
        ? { newToken: roleAssignment.newToken, user: roleAssignment.sessionUser }
        : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
