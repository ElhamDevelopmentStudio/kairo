import { ArrowRight01Icon, File02Icon } from "@hugeicons/core-free-icons";

import { HugeIcon } from "@/components/huge-icon";
import { cn } from "@/lib/utils";

import { timelineItems } from "./timeline-data";

const iconToneClass = {
  neutral: "border-white/14 bg-white/[0.055] text-kairo-white",
  green: "border-[#5cff45]/30 bg-[#5cff45]/5 text-[#5cff45]",
  blue: "border-[#43b9ff]/30 bg-[#43b9ff]/5 text-[#43b9ff]",
  purple: "border-[#bd71ff]/35 bg-[#bd71ff]/5 text-[#bd71ff]",
  yellow:
    "border-kairo-yellow bg-kairo-yellow/10 text-kairo-yellow shadow-[0_0_22px_rgba(251,215,8,0.42)]",
};

export function TimelinePanel() {
  return (
    <section className="relative ml-[75px] flex flex-1 flex-col pt-[115px] pr-[44px]">
      <div className="flex items-center justify-between border-white/8 border-b pb-[21px] font-mono text-[13px] text-kairo-muted tracking-[0.14em]">
        <span>PROJECT: ACME/FLUX</span>
        <span>TIMELINE: MAR 10 - APR 24</span>
      </div>

      <div className="relative flex-1">
        <div className="absolute top-[25px] bottom-[77px] left-[129px] w-px bg-white/14" />
        <div className="space-y-0">
          {timelineItems.map((item) => (
            <article
              className={cn(
                "grid min-h-[103px] grid-cols-[104px_70px_minmax(0,1fr)_248px] border-white/8 border-b font-mono",
                item.active && "min-h-[126px] border-white/10",
              )}
              key={`${item.date}-${item.title}`}
            >
              <div
                className={cn(
                  "pt-[31px] text-[14px] text-kairo-muted leading-[1.7]",
                  item.active && "pt-[29px] text-kairo-yellow",
                )}
              >
                <div>{item.date}</div>
                <div className="text-[12px]">{item.time}</div>
              </div>

              <div className="relative flex justify-center pt-[23px]">
                {item.active && (
                  <span className="absolute top-[23px] left-[7px] h-[56px] w-px bg-kairo-yellow" />
                )}
                <span
                  className={cn(
                    "relative z-10 flex size-[52px] items-center justify-center rounded-full border",
                    item.active &&
                      "size-[66px] border-2 outline outline-1 outline-kairo-yellow/70 outline-offset-[5px]",
                    iconToneClass[item.iconTone],
                  )}
                >
                  <HugeIcon
                    icon={item.icon}
                    className={cn("size-[25px]", item.active && "size-[28px]")}
                  />
                </span>
              </div>

              <div className={cn("pt-[31px] pl-[34px]", item.active && "pt-[31px]")}>
                <h2
                  className={cn(
                    "font-sans text-[18px] text-kairo-white",
                    item.active && "text-kairo-yellow",
                  )}
                >
                  {item.title}
                </h2>
                <p className="mt-[7px] text-[14px] text-kairo-copy leading-[1.45]">
                  {item.description}
                </p>
                {item.badge ? (
                  <div className="mt-[12px] inline-flex h-[27px] items-center rounded-[2px] border border-kairo-yellow/60 px-[11px] font-mono text-[12px] text-kairo-yellow tracking-[0.12em]">
                    {item.badge}
                  </div>
                ) : null}
              </div>

              <div
                className={cn(
                  "pt-[28px] pl-[32px] text-[13px] text-kairo-copy leading-[1.8]",
                  item.active && "pt-[31px]",
                )}
              >
                {item.note ? (
                  <p className="-ml-[54px] border-kairo-yellow/65 border-l pl-[22px] text-[14px] leading-[1.75]">
                    {item.note}
                  </p>
                ) : (
                  <>
                    <div>{item.stats}</div>
                    {item.files?.map((file) => (
                      <div key={file}>{file}</div>
                    ))}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="flex h-[50px] items-center justify-between font-mono text-[13px] text-kairo-dim">
        <div className="flex items-center gap-3">
          <HugeIcon icon={File02Icon} className="size-[21px]" />
          <span>8 summaries generated</span>
        </div>
        <a className="flex items-center gap-3" href="#timeline">
          View full timeline
          <HugeIcon icon={ArrowRight01Icon} className="size-[18px]" />
        </a>
      </div>
    </section>
  );
}
