import type { ReactNode } from "react";

type HomePageShellProps = {
  children: ReactNode;
};

export function HomePageShell({ children }: HomePageShellProps) {
  return (
    <div className="relative min-h-full overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <div className="relative bg-[#17121f] mx-auto flex min-h-full w-full max-w-lg flex-col  pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        {children}
      </div>
    </div>
  );
}
