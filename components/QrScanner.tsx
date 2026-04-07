"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

type QrScannerProps = {
  onDecoded?: (text: string) => void;
  enabled?: boolean;
};

export function QrScanner({ onDecoded, enabled = true }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const id = "qr-reader-inline";
    let cancelled = false;

    const start = async () => {
      const scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            setLastScan(decodedText);
            onDecoded?.(decodedText);
          },
          () => {}
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
      {lastScan && !error && (
        <p className="mt-3 break-all rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
          {lastScan}
        </p>
      )}
    </div>
  );
}
