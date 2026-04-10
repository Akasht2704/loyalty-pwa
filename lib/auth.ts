import jwt from "jsonwebtoken";

type JwtPayload = {
  userId: number;
  phone: string;
  appId: number;
  roleId: number;
  brandId: number | null;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("JWT secret is not configured");
  }
  return secret;
};

export const signAuthToken = (payload: JwtPayload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
};
