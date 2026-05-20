import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { BrandLogo } from "@/components/brand-logo";
import { HugeIcon } from "@/components/huge-icon";
import { Button } from "@/components/ui/button";

const navItems = ["Why Kairo", "How it works", "Integrations", "Docs"];

export function SiteHeader() {
  return (
    <header className="absolute top-0 right-0 left-0 z-10 flex h-[120px] items-center justify-between px-[40px]">
      <BrandLogo />
      <nav className="ml-auto flex items-center gap-[38px] pr-[82px] text-[14px] text-kairo-white">
        {navItems.map((item) => (
          <a
            className="transition-colors hover:text-kairo-yellow"
            href={`#${item.toLowerCase().replaceAll(" ", "-")}`}
            key={item}
          >
            {item}
          </a>
        ))}
      </nav>
      <Button
        className="h-[47px] min-w-[214px] rounded-[3px] border border-kairo-yellow/70 bg-transparent px-5 font-medium text-[15px] text-kairo-yellow hover:bg-kairo-yellow hover:text-black"
        variant="outline"
      >
        Download for macOS
        <HugeIcon icon={ArrowDown01Icon} className="ml-2 size-5" />
      </Button>
    </header>
  );
}
