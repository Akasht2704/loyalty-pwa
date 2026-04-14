"use client";

import { Html5Qrcode } from "html5-qrcode";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type QrScannerProps = {
  onDecoded?: (text: string) => void;
  enabled?: boolean;
  validate?: (text: string) => boolean;
};

/** Min time between API calls for the same QR payload (camera often decodes every frame). */
const SAME_QR_API_COOLDOWN_MS = 7500;

function readDeviceCoordinates(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 12_000,
      },
    );
  });
}

export function QrScanner({
  onDecoded,
  enabled = true,
  validate,
}: QrScannerProps) {
  const { data: session } = useSession();
  const accessTokenRef = useRef<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [isValidScan, setIsValidScan] = useState<boolean | null>(null);
  const [invalidHint, setInvalidHint] = useState(false);
  const [couponData, setCouponData] = useState<any>(null);
  const [pointsNotice, setPointsNotice] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const decodeErrorCountRef = useRef(0);
  const lastApiCallAtByQrRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    accessTokenRef.current = session?.accessToken;
  }, [session?.accessToken]);

  useEffect(() => {
    if (!enabled) return;
    const id = "qr-reader-inline";
    let cancelled = false;

    const start = async () => {
      const scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;
      decodeErrorCountRef.current = 0;
      setInvalidHint(false);
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (decodedText) => {
            const normalized = decodedText.trim();
            if (!normalized) return;

            const now = Date.now();
            const lastAt = lastApiCallAtByQrRef.current.get(normalized) ?? 0;
            if (now - lastAt < SAME_QR_API_COOLDOWN_MS) {
              return;
            }
            lastApiCallAtByQrRef.current.set(normalized, now);

            setLastScan(normalized);
            const coords = await readDeviceCoordinates();
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            const token = accessTokenRef.current;
            if (token) {
              headers.Authorization = `Bearer ${token}`;
            }
            const response = await fetch("/api/qrscan", {
              method: "POST",
              headers,
              credentials: "include",
              body: JSON.stringify({
                qrcode: normalized,
                scan_data: { qr_code: normalized },
                ...(coords
                  ? { latitude: coords.latitude, longitude: coords.longitude }
                  : {}),
              }),
            });
            const data = await response.json();
            if (typeof data?.pointsMessage === "string" && data.pointsMessage.trim()) {
              setPointsNotice(data.pointsMessage.trim());
            } else if (
              typeof data?.pointsEarned === "number" &&
              Number.isFinite(data.pointsEarned)
            ) {
              setPointsNotice(`Points credited: ${data.pointsEarned}`);
            } else {
              setPointsNotice(null);
            }

            const rows = data.data;
            const hasCoupon =
              Array.isArray(rows) && rows.length > 0 && data.success === true;
            const formatOk = validate
              ? validate(normalized)
              : normalized.length > 0;
            setIsValidScan(Boolean(hasCoupon && formatOk));
            if (hasCoupon) {
              setCouponData(rows);
            } else {
              setCouponData(null);
            }

            if (
              hasCoupon &&
              typeof data.newToken === "string" &&
              data.user &&
              typeof data.user === "object"
            ) {
              await signIn("credentials", {
                redirect: false,
                token: data.newToken,
                user: JSON.stringify(data.user),
              });
            }

            decodeErrorCountRef.current = 0;
            setInvalidHint(false);
            onDecoded?.(normalized);
          },
          () => {
            decodeErrorCountRef.current += 1;
            if (decodeErrorCountRef.current > 20) {
              setInvalidHint(true);
            }
          }
        );
      } catch {
        if (!cancelled) {
          setError("Could not start the camera. Allow access or use HTTPS.");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (!s) return;
      if (s.isScanning) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {
            try {
              s.clear();
            } catch {
              /* ignore */
            }
          });
      } else {
        try {
          s.clear();
        } catch {
          /* ignore */
        }
      }
    };
  }, [onDecoded, enabled]);

  return (
    <div className="w-full max-w-md">
      {error && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          {error}
        </p>
      )}
      <div
        id="qr-reader-inline"
        className="overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5 [&_video]:rounded-2xl"
      />
      <div className="mt-3 space-y-2">
        {!lastScan && !error && (
          <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            Waiting for QR code...
          </p>
        )}
        {!lastScan && invalidHint && !error && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            QR not recognized yet. Make sure it is a valid QR and fully visible.
          </p>
        )}
        {lastScan && !error && (
          <>
            <p
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                isValidScan
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
              }`}
            >
              {isValidScan ? "Valid QR code scanned" : "Invalid QR code"}
            </p>
            <p className="break-all rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
              {lastScan}
            </p>
            {couponData && (
              <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                {couponData[0]?.product_name}
              </p>
            )}
            {pointsNotice && (
              <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
                {pointsNotice}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
