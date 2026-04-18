export type ScanRequestBody = {
  qrcode?: string;
  scanState?: string;
  scanDistrict?: string;
  scanCity?: string;
  latitude?: number;
  longitude?: number;
  scan_data?: unknown;
};

export function trimOpt(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export function finiteCoord(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

export function optionalInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function expiryDateFromDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, Math.trunc(days)));
  return d.toISOString().slice(0, 10);
}

export function parseRoleIdsFromLoyaltySequence(raw: unknown): number[] {
  if (!raw) return [];
  try {
    const parsed =
      typeof raw === "string"
        ? (JSON.parse(raw) as { role_id?: unknown })
        : (raw as { role_id?: unknown });
    const roleIds = Array.isArray(parsed?.role_id) ? parsed.role_id : [];
    return roleIds
      .map((v) => optionalInt(v))
      .filter((v): v is number => v != null);
  } catch {
    return [];
  }
}

export function scanDataJsonFromFrontend(
  body: ScanRequestBody,
  fallbackQrCode: string,
): string {
  const raw = body.scan_data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const qc = (raw as Record<string, unknown>).qr_code;
    if (typeof qc === "string" && qc.trim()) {
      return JSON.stringify({ qr_code: qc.trim() });
    }
  }
  return JSON.stringify({ qr_code: fallbackQrCode });
}
