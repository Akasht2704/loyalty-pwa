"use client";

import { useMemo, useState } from "react";
import { QrScanner } from "@/components/QrScanner";

type PermissionStatus = "unknown" | "granted" | "denied";

export function ScanPermissionGate() {
  const [camera, setCamera] = useState<PermissionStatus>("unknown");
  const [location, setLocation] = useState<PermissionStatus>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canScan = camera === "granted" && location === "granted";

  const statusText = useMemo(() => {
    if (canScan) return "All permissions granted.";
    return "Camera and location access are required before scanning.";
  }, [canScan]);

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((track) => track.stop());
      setCamera("granted");
      return true;
    } catch {
      setCamera("denied");
      return false;
    }
  };

  const requestLocation = async () => {
    return new Promise<boolean>((resolve) => {
      if (!("geolocation" in navigator)) {
        setLocation("denied");
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => {
          setLocation("granted");
          resolve(true);
        },
        () => {
          setLocation("denied");
          resolve(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const requestPermissions = async () => {
    setBusy(true);
    setError(null);
    const cameraOk = await requestCamera();
    const locationOk = await requestLocation();
    if (!cameraOk || !locationOk) {
      setError("Please allow both Camera and Location permissions to scan QR code.");
    }
    setBusy(false);
  };
 
  return (
    <div className="space-y-4">
      {!canScan && (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          <p className="text-sm font-medium">{statusText}</p>
          <div className="mt-2 text-xs opacity-90">
            Camera: {camera} | Location: {location}
          </div>
          {error && <p className="mt-2 text-xs">{error}</p>}
          <button
            type="button"
            onClick={requestPermissions}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {busy ? "Requesting permissions..." : "Allow camera and location"}
          </button>
        </div>
      )}

      <QrScanner enabled={canScan} />
    </div>
  );
}
