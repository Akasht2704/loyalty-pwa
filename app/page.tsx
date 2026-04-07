import {
  BannerSection,
  HomePageShell,
  LogoSection,
  QrScanSection,
  ServicesSection,
} from "@/components/sections";

export default function Home() {
  return (

   <HomePageShell><LogoSection />
   <BannerSection />
   <QrScanSection />
   <ServicesSection />
   </ HomePageShell>
  );
}
