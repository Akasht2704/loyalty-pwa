import Link from "next/link";
import { QrScanIcon } from "@/components/icons/QrScanIcon";

export function QrScanSection() {
  return (
    <section
      className="mb-2"
      aria-labelledby="scan-heading"
      aria-describedby="scan-desc"
    >
      

         <div className="relative overflow-hidden p-4 ">
          <Link
            href="/scan"
            className="group flex  items-center justify-center gap-3 rounded-2xl bg-[#e1e1e1] px-1 py-4 text-base font-bold text-indigo-700 shadow-lg transition hover:bg-zinc-50 hover:shadow-md active:scale-[0.98] dark:bg-zinc-950 dark:text-indigo-300 dark:hover:bg-zinc-900"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 transition group-hover:scale-105 group-hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:group-hover:bg-indigo-900">
              <QrScanIcon className="h-6 w-6" />
            </span>
            <span className="flex flex-col items-start text-left">
              <span>Scan QR code</span>
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                Open camera to earn points
              </span>
            </span>
          </Link>
          </div>
       
      
    </section>
  );
}

