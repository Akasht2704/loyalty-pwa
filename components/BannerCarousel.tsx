// "use client";

// import { useCallback, useEffect, useState } from "react";

// type Slide = {
//   id: string;
//   title: string;
//   subtitle: string;
//   gradient: string;
//   accent: string;
// };

// const SLIDES: Slide[] = [
//   {
//     id: "1",
//     title: "Welcome back",
//     subtitle: "Your rewards are waiting",
//     gradient: "from-violet-600 via-indigo-600 to-indigo-800",
//     accent: "from-white/20 to-transparent",
//   },
//   {
//     id: "2",
//     title: "Scan & earn",
//     subtitle: "Collect points on every visit",
//     gradient: "from-fuchsia-600 via-rose-600 to-orange-600",
//     accent: "from-white/25 to-transparent",
//   },
//   {
//     id: "3",
//     title: "Exclusive perks",
//     subtitle: "Members-only offers this week",
//     gradient: "from-emerald-600 via-teal-600 to-cyan-700",
//     accent: "from-white/20 to-transparent",
//   },
// ];

// const INTERVAL_MS = 5500;

// export function BannerCarousel() {
//   const [index, setIndex] = useState(0);
//   const [paused, setPaused] = useState(false);

//   const goTo = useCallback((i: number) => {
//     setIndex((i + SLIDES.length) % SLIDES.length);
//   }, []);

//   useEffect(() => {
//     if (paused) return;
//     const t = window.setInterval(() => {
//       setIndex((i) => (i + 1) % SLIDES.length);
//     }, INTERVAL_MS);
//     return () => window.clearInterval(t);
//   }, [paused]);

//   return (
//     <div
//       className="w-full"
//       onPointerEnter={() => setPaused(true)}
//       onPointerLeave={() => setPaused(false)}
//     >
//       <div className="relative overflow-hidden  shadow-xl shadow-zinc-900/10 ring-1 ring-black/5 dark:shadow-black/40 dark:ring-white/10">
//         <div
//           className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.35),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.12),transparent)]"
//           aria-hidden
//         />
//         <div
//           className="flex transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
//           style={{ transform: `translateX(-${index * 100}%)` }}
//         >
//           {SLIDES.map((slide) => (
//             <article
//               key={slide.id}
//               className={`relative min-w-full overflow-hidden bg-gradient-to-br px-7 py-12 text-white ${slide.gradient}`}
//               aria-hidden={SLIDES[index].id !== slide.id}
//             >
//               <div
//                 className={`pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-gradient-to-br ${slide.accent} blur-2xl`}
//                 aria-hidden
//               />
//               <div
//                 className="pointer-events-none absolute -bottom-4 left-1/4 h-24 w-48 rounded-full bg-black/10 blur-xl"
//                 aria-hidden
//               />
//               <h3 className="relative text-2xl font-bold leading-tight tracking-tight drop-shadow-sm">
//                 {slide.title}
//               </h3>
//               <p className="relative mt-3 max-w-[18rem] text-[15px] leading-relaxed text-white/92">
//                 {slide.subtitle}
//               </p>
//             </article>
//           ))}
//         </div>
//         <div
//           className="absolute bottom-4 left-0 right-0 flex justify-center gap-2"
//           role="tablist"
//           aria-label="Banner slides"
//         >
//           {SLIDES.map((slide, i) => (
//             <button
//               key={slide.id}
//               type="button"
//               role="tab"
//               aria-selected={i === index}
//               aria-label={`Slide ${i + 1}`}
//               className={`h-2 rounded-full transition-all duration-300 ${
//                 i === index
//                   ? "w-7 bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
//                   : "w-2 bg-white/45 hover:bg-white/70"
//               }`}
//               onClick={() => goTo(i)}
//             />
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }


"use client";

import { useCallback, useEffect, useState } from "react";

type Slide = {
  id: string;
  image: string;
  alt: string;
  overlay: string;        // Gradient overlay for better text visibility (optional)
};

const SLIDES: Slide[] = [
  {
    id: "1",
    image: "https://picsum.photos/id/1015/1200/600",   // Replace with better direct links if needed
    alt: "Welcome back - Your rewards are waiting",
    overlay: "from-black/50 via-black/30 to-transparent",
  },
  {
    id: "2",
    image: "https://picsum.photos/id/201/1200/600",
    alt: "Scan & earn - Collect points on every visit",
    overlay: "from-black/60 via-black/25 to-transparent",
  },
  {
    id: "3",
    image: "https://picsum.photos/id/106/1200/600",
    alt: "Exclusive perks - Members-only offers",
    overlay: "from-black/45 via-transparent to-black/40",
  },
];

const INTERVAL_MS = 5500;

export function BannerCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    setIndex((i + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <div
      className="w-full"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden shadow-xl shadow-zinc-900/10 ring-1 ring-black/5 dark:shadow-black/40 dark:ring-white/10">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.2),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.08),transparent)] z-10"
          aria-hidden
        />

        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((slide) => (
            <article
              key={slide.id}
              className="relative min-w-full h-[260px] md:h-[340px] lg:h-[380px] overflow-hidden"
            >
              {/* Banner Image */}
              <img
                src={slide.image}
                alt={slide.alt}
                className="absolute inset-0 h-full w-full object-cover"
              />

              {/* Gradient Overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${slide.overlay} z-10`}
              />

              {/* Optional Text Overlay (uncomment if you want text on image) */}
              {/*
              <div className="absolute inset-0 z-20 flex flex-col justify-end px-8 pb-10">
                <h3 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                  Welcome back
                </h3>
                <p className="mt-2 text-lg text-white/90 max-w-md">
                  Your rewards are waiting
                </p>
              </div>
              */}
            </article>
          ))}
        </div>

        {/* Dots */}
        <div
          className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 z-20"
          role="tablist"
          aria-label="Banner slides"
        >
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-9 bg-white shadow-lg"
                  : "w-2.5 bg-white/60 hover:bg-white/90"
              }`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}