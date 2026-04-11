/** Reverse geocode via OpenStreetMap Nominatim (server-side; respect usage policy). */

export type GeocodeAddressParts = {
  scanState?: string;
  scanDistrict?: string;
  scanCity?: string;
};

export async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number,
): Promise<GeocodeAddressParts> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "pwa-loyalty/1.0",
      },
      cache: "no-store",
    });

    if (!res.ok) return {};

    const data = (await res.json()) as {
      address?: Record<string, string>;
    };
    const addr = data.address ?? {};

    const scanState = addr.state || addr.region || undefined;
    const scanDistrict =
      addr.county || addr.state_district || addr.district || undefined;
    const scanCity =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      undefined;

    return {
      ...(scanState ? { scanState } : {}),
      ...(scanDistrict ? { scanDistrict } : {}),
      ...(scanCity ? { scanCity } : {}),
    };
  } catch {
    return {};
  }
}
