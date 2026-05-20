import { ArrowRight01Icon, Download01Icon, LockPasswordIcon } from "@hugeicons/core-free-icons";

import { HugeIcon } from "@/components/huge-icon";
import { Button } from "@/components/ui/button";

export function HeroPanel() {
  return (
    <section className="flex min-h-[1024px] w-[520px] shrink-0 flex-col pt-[260px] pl-[53px]">
      <div className="mb-[44px]">
        <h1 className="max-w-[470px] font-sans font-medium text-[82px] text-kairo-white leading-[1.08] tracking-[-0.055em]">
          Git history
          <br />
          for <span className="text-kairo-yellow">humans.</span>
        </h1>
        <div className="mt-[31px] h-px w-[41px] bg-kairo-yellow" />
        <p className="mt-[35px] max-w-[393px] font-mono text-[16px] text-kairo-copy leading-[1.9] tracking-[-0.02em]">
          Kairo reconstructs how your software evolves—capturing context, intent, and architecture
          changes so you never lose understanding again.
        </p>
      </div>

      <div className="flex gap-6">
        <Button className="h-[55px] w-[218px] rounded-[3px] bg-kairo-yellow font-medium text-[15px] text-black shadow-[0_0_28px_rgba(251,215,8,0.15)] hover:bg-kairo-yellow/90">
          <HugeIcon icon={Download01Icon} className="mr-2 size-[19px]" />
          Download for macOS
        </Button>
        <Button className="h-[55px] w-[225px] rounded-[3px] border border-white/15 bg-transparent font-medium text-[15px] text-kairo-white hover:border-white/30 hover:bg-white/[0.04]">
          Explore a demo project
          <HugeIcon icon={ArrowRight01Icon} className="ml-3 size-[19px]" />
        </Button>
      </div>

      <p className="mt-[48px] flex items-center gap-3 font-mono text-[13px] text-kairo-dim">
        <HugeIcon icon={LockPasswordIcon} className="size-[18px]" />
        100% local. Your data stays on your machine.
      </p>
    </section>
  );
}
