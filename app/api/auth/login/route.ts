import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { signAuthToken } from "@/lib/auth";

/** Temporary fixed OTP; replace with SMS-generated codes later. */
const HARDCODED_OTP = "1234";
const OTP_TTL_MINUTES = 10;

type UserRow = RowDataPacket & {
  id?: number;
  user_id?: number;
  name?: string;
  phone?: string;
  password?: string;
};

type UserRoleRow = RowDataPacket & {
  role_id?: number;
  brand_id?: number | null;
};

type DefaultRoleRow = RowDataPacket & {
  role_id?: number;
  name?: string;
};

const resolveAppId = (rawAppId?: number) => {
  if (rawAppId && Number.isInteger(rawAppId)) return rawAppId;
  const envAppId = Number(process.env.APP_ID);
  if (!Number.isInteger(envAppId)) {
    throw new Error("APP_ID is not configured properly");
  }
  return envAppId;
};

const getDefaultRole = async () => {
  const [defaultRoles] = await db.execute<DefaultRoleRow[]>(
    "SELECT id AS role_id, name FROM roles WHERE is_default = TRUE AND brand_id IS NULL LIMIT 1",
  );
  const defaultRole = defaultRoles[0];

  if (!defaultRole?.role_id || !defaultRole?.name) {
    throw new Error("Default role is not configured");
  }

  return {
    roleId: defaultRole.role_id,
    roleName: defaultRole.name,
  };
};

type OtpRow = RowDataPacket & {
  id?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { phone, otp, appId } = await request.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }

    const normalizedPhone = phone.trim();
    const resolvedAppId = resolveAppId(appId);

    const [users] = await db.execute<UserRow[]>(
      "SELECT * FROM users WHERE phone = ? LIMIT 1",
      [normalizedPhone]
    );

    const user = users[0];
    if (!user) {
      return NextResponse.json({
        requiresRegistration: true,
        phone: normalizedPhone,
      });
    }

    const userId = user.user_id ?? user.id;
    if (!userId) {
      throw new Error("Unable to resolve user id");
    }

    const [roles] = await db.execute<UserRoleRow[]>(
      "SELECT role_id, brand_id FROM user_roles WHERE user_id = ? AND app_id = ? LIMIT 1",
      [userId, resolvedAppId]
    );

    if (roles.length === 0) {
      return NextResponse.json({
        requiresRegistration: true,
        phone: normalizedPhone,
        existingUser: true,
      });
    }

    const otpTrimmed =
      typeof otp === "string" && otp.trim().length > 0 ? otp.trim() : undefined;

    if (!otpTrimmed) {
      await db.execute<ResultSetHeader>(
        `INSERT INTO otps (phone, app_id, code, expires_at)
         VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [normalizedPhone, resolvedAppId, HARDCODED_OTP, OTP_TTL_MINUTES],
      );

      return NextResponse.json({
        requiresOtp: true,
        phone: normalizedPhone,
      });
    }

    const [otpRows] = await db.execute<OtpRow[]>(
      `SELECT id FROM otps
       WHERE phone = ? AND app_id = ? AND code = ?
         AND expires_at > NOW() AND consumed_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [normalizedPhone, resolvedAppId, otpTrimmed],
    );

    const otpRow = otpRows[0];
    if (!otpRow?.id) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 401 },
      );
    }

    await db.execute<ResultSetHeader>(
      "UPDATE otps SET consumed_at = NOW() WHERE id = ?",
      [otpRow.id],
    );

    const defaultRole = await getDefaultRole();
    const roleId = roles[0].role_id ?? defaultRole.roleId;
    const brandId = roles[0].brand_id ?? null;

    const token = signAuthToken({
      userId,
      name: user.name ?? "",
      phone: user.phone ?? normalizedPhone,
      appId: resolvedAppId,
      roleId,
      brandId,
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        userId,
        name: user.name ?? "",
        phone: user.phone ?? normalizedPhone,
        appId: resolvedAppId,
        roleId,
        brandId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Login failed" },
      { status: 500 }
    );
  }
}
