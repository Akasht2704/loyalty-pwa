import type { ReactNode } from "react";

type ServiceCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
};

export function ServiceCard({ title, icon }: ServiceCardProps) {
  return (
    <article className="group relative flex min-h-[7.5rem] min-w-0 w-full sm:min-h-[8.5rem]">
      <div className="relative flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-white/90 p-3 shadow-sm backdrop-blur-sm transition duration-300 group-active:scale-[0.99] group-hover:border-indigo-200/80 group-hover:shadow-md group-hover:shadow-indigo-900/5 sm:gap-4 sm:p-4 dark:border-zinc-700/90 dark:bg-zinc-900/75 dark:group-hover:border-indigo-500/25">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-2xl shadow-inner shadow-white/50 dark:from-indigo-950 dark:to-violet-950 dark:shadow-none"
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 pt-0.5 text-center">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        </div>
      </div>
    </article>
  );
}
