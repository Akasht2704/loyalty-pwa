import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signAuthToken } from "@/lib/auth";

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
    const { phone, password, appId } = await request.json();

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

    if (!password || typeof password !== "string") {
      return NextResponse.json({
        requiresPassword: true,
        phone: normalizedPhone,
      });
    }

    const plainPassword = password;
    const defaultRole = await getDefaultRole();

    const passwordHash = user.password;
    if (!passwordHash) {
      return NextResponse.json(
        { error: "Invalid phone or password" },
        { status: 401 }
      );
    }

    const isPasswordValid = await bcrypt.compare(plainPassword, passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid phone or password" },
        { status: 401 }
      );
    }

    const userId = user.user_id ?? user.id;
    if (!userId) {
      throw new Error("Unable to resolve user id");
    }

    const [roles] = await db.execute<UserRoleRow[]>(
      "SELECT role_id, brand_id FROM user_roles WHERE user_id = ? AND app_id = ? LIMIT 1",
      [userId, resolvedAppId]
    );

    let roleId = defaultRole.roleId;
    let brandId: number | null = null;

    if (roles.length === 0) {
      await db.execute(
        "INSERT INTO user_roles (user_id, app_id, role_id, role_name, brand_id) VALUES (?, ?, ?, ?, NULL)",
        [userId, resolvedAppId, defaultRole.roleId, defaultRole.roleName]
      );
    } else {
      roleId = roles[0].role_id ?? defaultRole.roleId;
      brandId = roles[0].brand_id ?? null;
    }

    const token = signAuthToken({
      userId,
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
