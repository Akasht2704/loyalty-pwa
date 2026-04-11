import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signAuthToken } from "@/lib/auth";

type UserRow = RowDataPacket & {
  id?: number;
  user_id?: number;
  name?: string;
  phone?: string;
};

type UserRoleExistsRow = RowDataPacket & {
  n?: number;
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
    "SELECT id AS role_id, name FROM roles WHERE is_default = TRUE LIMIT 1"
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

export async function POST(request: NextRequest) {
  try {
    const { name, phone, appId } = await request.json();

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Name and phone are required" },
        { status: 400 }
      );
    }

    const normalizedName = String(name).trim();
    const normalizedPhone = String(phone).trim();
    const resolvedAppId = resolveAppId(appId);
    const defaultRole = await getDefaultRole();

    const unusablePasswordHash = await bcrypt.hash(
      randomBytes(32).toString("hex"),
      10,
    );

    const [existingUsers] = await db.execute<UserRow[]>(
      "SELECT * FROM users WHERE phone = ? LIMIT 1",
      [normalizedPhone]
    );
    const existing = existingUsers[0];

    let userId: number;

    if (existing) {
      const resolvedUserId = existing.user_id ?? existing.id;
      if (!resolvedUserId) {
        throw new Error("Unable to resolve user id");
      }

      await db.execute(
        "UPDATE users SET name = ?, password = ? WHERE phone = ?",
        [normalizedName, unusablePasswordHash, normalizedPhone]
      );

      const [existingAppRoles] = await db.execute<UserRoleExistsRow[]>(
        "SELECT 1 AS n FROM user_roles WHERE user_id = ? AND app_id = ? LIMIT 1",
        [resolvedUserId, resolvedAppId]
      );
      if (existingAppRoles.length > 0) {
        return NextResponse.json(
          { error: "Already registered for this app. Please login." },
          { status: 409 }
        );
      }
      userId = resolvedUserId;
    } else {
      const [insertedUser] = await db.execute<ResultSetHeader>(
        "INSERT INTO users (name, phone, password) VALUES (?, ?, ?)",
        [normalizedName, normalizedPhone, unusablePasswordHash]
      );

      const insertedId = insertedUser.insertId;
      if (!insertedId) {
        throw new Error("User could not be created");
      }
      userId = insertedId;
    }

    await db.execute(
      "INSERT INTO user_roles (user_id, app_id, role_id, role_name, brand_id) VALUES (?, ?, ?, ?, NULL)",
      [userId, resolvedAppId, defaultRole.roleId, defaultRole.roleName]
    );

    const token = signAuthToken({
      userId,
      name: normalizedName,
      phone: normalizedPhone,
      appId: resolvedAppId,
      roleId: defaultRole.roleId,
      brandId: null,
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        userId,
        name: normalizedName,
        phone: normalizedPhone,
        appId: resolvedAppId,
        roleId: defaultRole.roleId,
        brandId: null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Registration failed" },
      { status: 500 }
    );
  }
}
