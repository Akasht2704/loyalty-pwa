import { ServiceLinkCard } from "@/components/ServiceLinkCard";
import { ServiceCard } from "@/components/ServiceCard";
import { HOME_SERVICES } from "@/data/home-services";

export function ServicesSection() {
  return (
    <section className="pb-2" aria-labelledby="services-heading">
      <h2 className="text-2xl font-bold text-center text-white">Services</h2>

      <div className="grid w-full grid-cols-2 gap-3 p-4 sm:gap-4">
        {HOME_SERVICES.map((s) =>
          s.kind === "link" ? (
            <ServiceLinkCard key={s.title} title={s.title} icon={s.icon} href={s.href} />
          ) : (
            <ServiceCard key={s.title} title={s.title} description={s.description} icon={s.icon} />
          ),
        )}
      </div>
    </section>
  );
}
