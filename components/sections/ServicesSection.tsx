import { ServiceCard } from "@/components/ServiceCard";
import { HOME_SERVICES } from "@/data/home-services";

export function ServicesSection() {
  return (
    <section className="pb-2" aria-labelledby="services-heading">
      <h2 className="text-2xl font-bold text-center text-white">Services</h2>
      
      <div className="flex  flex-row flex-wrap p-4 gap-3">
        {HOME_SERVICES.map((s) => (
         
            <ServiceCard key={s.title} title={s.title} description={s.description} icon={s.icon} />
          
        ))}
      </div>
    </section>
  );
}
