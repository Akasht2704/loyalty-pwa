import { BannerCarousel } from "@/components/BannerCarousel";

export function BannerSection() {
  return (
    <section className="mb-5" aria-labelledby="banner-heading">
      <BannerCarousel />
    </section>
  );
}
