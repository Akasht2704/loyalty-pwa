import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone?: string;
      appId?: number;
      roleId?: number;
      brandId?: number | null;
    };
  }

  interface User {
    phone?: string;
    appId?: number;
    roleId?: number;
    brandId?: number | null;
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    phone?: string;
    appId?: number;
    roleId?: number;
    brandId?: number | null;
  }
}
