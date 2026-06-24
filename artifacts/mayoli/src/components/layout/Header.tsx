import { Link, useLocation } from "wouter";
import { Gem } from "lucide-react";

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
      <Link href="/">
        <div className="flex flex-col items-center justify-center cursor-pointer">
          <h1 className="font-serif text-2xl text-[#D4AF37] tracking-widest leading-none">MAYOLI</h1>
          <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Joias Finas</span>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        {/* Actions could go here */}
      </div>
    </header>
  );
}
