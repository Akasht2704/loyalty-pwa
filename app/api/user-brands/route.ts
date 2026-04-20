import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getBearerToken, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";

type UserBrandRow = RowDataPacket & {
  brand_id?: number | null;
  brand_name?: string | null;
  role_id?: number | null;
  role_name?: string | null;
  mapped_role_name?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const bearer = getBearerToken(request);
    const auth = bearer ? verifyAuthToken(bearer) : null;
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [rows] = await db.execute<UserBrandRow[]>(
      `SELECT
        ur.brand_id,
        b.name AS brand_name,
        ur.role_id,
        ur.role_name,
        r.name AS mapped_role_name
      FROM user_roles ur
      LEFT JOIN brands b ON b.id = ur.brand_id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.app_id = ? AND ur.brand_id IS NOT NULL`,
      [auth.userId, auth.appId],
    );

    console.log("rows", rows);

    const options = Array.from(
      new Map(
        rows
          .filter((row) => row.brand_id != null)
          .map((row) => [
            Number(row.brand_id),
            {
              brandId: Number(row.brand_id),
              brandName:
                typeof row.brand_name === "string" && row.brand_name.trim()
                  ? row.brand_name.trim()
                  : `Brand ${Number(row.brand_id)}`,
              roleId:
                typeof row.role_id === "number" && Number.isFinite(row.role_id)
                  ? row.role_id
                  : null,
              roleName:
                typeof row.mapped_role_name === "string" && row.mapped_role_name.trim()
                  ? row.mapped_role_name.trim()
                  : typeof row.role_name === "string" && row.role_name.trim()
                    ? row.role_name.trim()
                  : null,
            },
          ]),
      ).values(),
    );

    return NextResponse.json({ success: true, data: options });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to load brands" },
      { status: 500 },
    );
  }
}
