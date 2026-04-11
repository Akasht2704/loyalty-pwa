import jwt from "jsonwebtoken";

export type AuthJwtPayload = {
  userId: number;
  phone: string;
  appId: number;
  roleId: number;
  brandId: number | null;
  name: string;
};

const getJwtSecret = () => {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT secret is not configured");
  }
  return secret;
};

const jwtNumeric = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
};

export const parseAuthJwtPayload = (decoded: unknown): AuthJwtPayload | null => {
  if (!decoded || typeof decoded !== "object") return null;
  const d = decoded as Record<string, unknown>;
  if (typeof d.phone !== "string" || !d.phone.trim()) return null;

  const userId = jwtNumeric(d.userId);
  const appId = jwtNumeric(d.appId);
  const roleId = jwtNumeric(d.roleId);
  if (userId === null || appId === null || roleId === null) return null;

  let brandId: number | null;
  if (d.brandId === null || d.brandId === undefined) {
    brandId = null;
  } else {
    const b = jwtNumeric(d.brandId);
    if (b === null) return null;
    brandId = b;
  }

  return {
    userId,
    phone: d.phone,
    appId,
    roleId,
    brandId,
    name: typeof d.name === "string" ? d.name : "",
  };
};

export const signAuthToken = (payload: AuthJwtPayload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
};

export const verifyAuthToken = (token: string): AuthJwtPayload | null => {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return parseAuthJwtPayload(decoded);
  } catch {
    return null;
  }
};

/** Reads `Authorization: Bearer <token>` for API / mobile clients. */
export const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const t = header.slice(7).trim();
  return t.length > 0 ? t : null;
};
