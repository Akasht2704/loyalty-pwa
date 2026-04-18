import type { ReactNode } from "react";

export type HomeServiceItem =
  | { kind: "card"; title: string; description: string; icon: ReactNode }
  | { kind: "link"; title: string; description: string; icon: ReactNode; href: string };

export const HOME_SERVICES: HomeServiceItem[] = [
  {
    kind: "link",
    title: "Loyalty",
    description: "Track points, rewards, and member benefits.",
    icon: "⭐",
    href: "/loyalty",
  },
  {
    kind: "link",
    title: "Scan history",
    description: "QR codes you scanned, with product and MRP details.",
    icon: "📋",
    href: "/scan-logs",
  },
  {
    kind: "card",
    title: "Dispatch",
    description: "View dispatch updates and shipment progress.",
    icon: "🚚",
  },
];
