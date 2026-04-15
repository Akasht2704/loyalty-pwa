import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { signBasicAuthToken } from "@/lib/auth";

type AuthDetailRow = RowDataPacket & {
  app_id?: number;
  user_id?: number;
  brand_id?: number | null;
};

type UserRoleRow = RowDataPacket & {
  role_id?: number;
};

type RolePermissionRow = RowDataPacket & {
  permission_json?: unknown;
};

const toIntOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

const parsePermissionJson = (raw: unknown) => {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authKeyRaw =
      typeof body?.auth_key === "string"
        ? body.auth_key
        : typeof body?.authKey === "string"
          ? body.authKey
          : "";
    const authKey = authKeyRaw.trim();

    if (!authKey) {
      return NextResponse.json(
        { success: false, error: "auth_key is required" },
        { status: 400 },
      );
    }

    const [authDetails] = await db.execute<AuthDetailRow[]>(
      `SELECT app_id, user_id, brand_id
       FROM auth_details
       WHERE authKey = ?
       LIMIT 1`,
      [authKey],
    );

    const authDetail = authDetails[0];
    const appId = toIntOrNull(authDetail?.app_id);
    const userId = toIntOrNull(authDetail?.user_id);
    const brandId = toIntOrNull(authDetail?.brand_id);

    if (appId == null || userId == null) {
      return NextResponse.json(
        { success: false, error: "Invalid auth_key" },
        { status: 401 },
      );
    }

    const [userRoleRows] =
      brandId == null
        ? await db.execute<UserRoleRow[]>(
            `SELECT role_id
             FROM user_roles
             WHERE user_id = ? AND app_id = ? AND brand_id IS NULL
             LIMIT 1`,
            [userId, appId],
          )
        : await db.execute<UserRoleRow[]>(
            `SELECT role_id
             FROM user_roles
             WHERE user_id = ? AND app_id = ? AND brand_id = ?
             LIMIT 1`,
            [userId, appId, brandId],
          );

    const roleId = toIntOrNull(userRoleRows[0]?.role_id);
    if (roleId == null) {
      return NextResponse.json(
        { success: false, error: "Role not found for this user/app/brand" },
        { status: 404 },
      );
    }

    const [roleRows] = await db.execute<RolePermissionRow[]>(
      `SELECT permission_json
       FROM roles
       WHERE id = ?
       LIMIT 1`,
      [roleId],
    );

    const permissionJson = parsePermissionJson(roleRows[0]?.permission_json);
    const token = signBasicAuthToken({
      userId,
      brandId,
      appId,
      roleId,
    });

    return NextResponse.json({
      success: true,
      token,
      permission_json: permissionJson,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Unable to generate token" },
      { status: 500 },
    );
  }
}
