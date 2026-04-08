"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

type QrScannerProps = {
  onDecoded?: (text: string) => void;
  enabled?: boolean;
  validate?: (text: string) => boolean;
};

export function QrScanner({
  onDecoded,
  enabled = true,
  validate,
}: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [isValidScan, setIsValidScan] = useState<boolean | null>(null);
  const [invalidHint, setInvalidHint] = useState(false);
  const [couponData, setCouponData] = useState<any>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const decodeErrorCountRef = useRef(0);

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
            setLastScan(decodedText);
            const response = await fetch("/api/qrscan", {
              method: "POST",
              body: JSON.stringify({ qrcode: decodedText }),
            });
            const data = await response.json();
            if (data.success) {
              setIsValidScan(true);
              setCouponData(data.data);
              console.log(data.data);
              onDecoded?.(decodedText);
            } else {
              setIsValidScan(false);
              onDecoded?.(decodedText);
            }

            const valid = validate ? validate(decodedText) : decodedText.trim().length > 0;
            setIsValidScan(valid);
            decodeErrorCountRef.current = 0;
            setInvalidHint(false);
            onDecoded?.(decodedText);
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
                {couponData[0].product_name}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
