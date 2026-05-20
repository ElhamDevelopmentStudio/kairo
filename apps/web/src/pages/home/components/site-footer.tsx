import { ArrowUpRight03Icon } from "@hugeicons/core-free-icons";

import { HugeIcon } from "@/components/huge-icon";

export function SiteFooter() {
  return (
    <footer className="absolute bottom-[47px] left-[52px] z-10 flex items-center gap-[24px] font-mono text-[12px] text-kairo-dim">
      <span>© 2024 Kairo</span>
      <span className="h-[14px] w-px bg-white/25" />
      <a href="#privacy">Privacy</a>
      <span className="h-[14px] w-px bg-white/25" />
      <a className="flex items-center gap-2" href="#github">
        GitHub <HugeIcon icon={ArrowUpRight03Icon} className="size-[14px]" />
      </a>
    </footer>
  );
}
