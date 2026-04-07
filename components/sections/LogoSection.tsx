

import Image from "next/image";
import Link from "next/link";

export function LogoSection() {
  return (
    <header className="mb-2 w-full p-1">
      <div className="flex flex-col items-center gap-3">
        <Link href="/" className="group">
          <Image
            src="/logo.jpg"   // Dashing modern logo
            alt="Loyalty Program"
            width={240}
            height={60}
            priority
            className="relative z-10 h-24 w-auto transition-transform duration-300 group-hover:scale-105 drop-shadow-md"
          />
        </Link>

        
       
      </div>
    </header>
  );
}