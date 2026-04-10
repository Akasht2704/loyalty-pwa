import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signAuthToken } from "@/lib/auth";

type UserRow = RowDataPacket & {
  id?: number;
  user_id?: number;
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
    const { name, phone, password, appId } = await request.json();

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: "Name, phone and password are required" },
        { status: 400 }
      );
    }

    const normalizedName = String(name).trim();
    const normalizedPhone = String(phone).trim();
    const resolvedAppId = resolveAppId(appId);
    const defaultRole = await getDefaultRole();

    const [existingUsers] = await db.execute<UserRow[]>(
      "SELECT * FROM users WHERE phone = ? LIMIT 1",
      [normalizedPhone]
    );
    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: "Phone already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const [insertedUser] = await db.execute<ResultSetHeader>(
      "INSERT INTO users (name, phone, password) VALUES (?, ?, ?)",
      [normalizedName, normalizedPhone, passwordHash]
    );

    const userId = insertedUser.insertId;
    if (!userId) {
      throw new Error("User could not be created");
    }

    await db.execute(
      "INSERT INTO user_roles (user_id, app_id, role_id, role_name, brand_id) VALUES (?, ?, ?, ?, NULL)",
      [userId, resolvedAppId, defaultRole.roleId, defaultRole.roleName]
    );

    const token = signAuthToken({
      userId,
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
