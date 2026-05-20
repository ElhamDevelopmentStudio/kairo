import { ArrowRight01Icon, File02Icon } from "@hugeicons/core-free-icons";

import { HugeIcon } from "@/components/huge-icon";
import { cn } from "@/lib/utils";

import { timelineItems } from "./timeline-data";

const iconToneClass = {
  neutral: "border-white/18 bg-[#111315] text-kairo-white",
  green: "border-[#5cff45]/55 bg-[#061006] text-[#5cff45]",
  blue: "border-[#43b9ff]/55 bg-[#061018] text-[#43b9ff]",
  purple: "border-[#bd71ff]/55 bg-[#100819] text-[#bd71ff]",
  yellow: "border-kairo-yellow/55 bg-[#171500] text-kairo-yellow",
};

export function TimelinePanel() {
  return (
    <section className="relative ml-[75px] flex flex-1 flex-col pt-[115px] pr-[44px]">
      <div className="flex items-center justify-between border-white/8 border-b pb-[21px] font-mono text-[13px] text-kairo-muted tracking-[0.14em]">
        <span>PROJECT: ACME/FLUX</span>
        <span>TIMELINE: MAR 10 - APR 24</span>
      </div>

      <div className="relative flex-1">
        <div className="space-y-0">
          {timelineItems.map((item, index) => (
            <article
              className="group/timeline-item grid min-h-[126px] grid-cols-[104px_70px_minmax(0,1fr)_248px] border-white/8 border-b font-mono transition-[min-height,border-color] duration-300 ease-out hover:min-h-[214px] hover:border-white/10"
              key={`${item.date}-${item.title}`}
            >
              <div className="pt-[29px] text-[14px] text-kairo-muted leading-[1.7] transition-colors duration-200 group-hover/timeline-item:text-kairo-yellow">
                <div>{item.date}</div>
                <div className="text-[12px]">{item.time}</div>
              </div>

              <div className="relative flex justify-center pt-[23px]">
                {index > 0 && (
                  <span className="absolute top-0 left-1/2 h-[23px] w-px -translate-x-1/2 bg-white/14 transition-[height] duration-200 group-hover/timeline-item:h-[17px]" />
                )}
                {index < timelineItems.length - 1 && (
                  <span className="absolute top-[75px] bottom-0 left-1/2 w-px -translate-x-1/2 bg-white/14 transition-[top] duration-200 group-hover/timeline-item:top-[95px]" />
                )}
                <span
                  className={cn(
                    "relative z-10 flex size-[52px] items-center justify-center rounded-full border shadow-[inset_0_0_18px_rgba(255,255,255,0.025)] transition-all duration-200 group-hover/timeline-item:size-[66px] group-hover/timeline-item:border-2 group-hover/timeline-item:border-kairo-yellow group-hover/timeline-item:bg-[#171500] group-hover/timeline-item:text-kairo-yellow group-hover/timeline-item:outline group-hover/timeline-item:outline-1 group-hover/timeline-item:outline-kairo-yellow/70 group-hover/timeline-item:outline-offset-[5px] group-hover/timeline-item:shadow-[0_0_30px_rgba(251,215,8,0.35),inset_0_0_24px_rgba(251,215,8,0.07)]",
                    iconToneClass[item.iconTone],
                  )}
                >
                  <HugeIcon
                    icon={item.icon}
                    className="size-[25px] transition-all duration-200 group-hover/timeline-item:size-[28px]"
                  />
                </span>
              </div>

              <div className="pt-[31px] pl-[34px]">
                <h2 className="font-sans text-[18px] text-kairo-white transition-colors duration-200 group-hover/timeline-item:text-kairo-yellow">
                  {item.title}
                </h2>
                <p className="mt-[7px] text-[14px] text-kairo-copy leading-[1.45]">
                  {item.description}
                </p>
                <div className="mt-[12px] inline-flex h-[27px] translate-y-1 items-center rounded-[2px] border border-kairo-yellow/60 px-[11px] font-mono text-[12px] text-kairo-yellow tracking-[0.12em] opacity-0 transition-all duration-300 ease-out group-hover/timeline-item:translate-y-0 group-hover/timeline-item:opacity-100">
                  {item.badge}
                </div>
              </div>

              <div className="relative min-h-[126px] pt-[28px] pl-[32px] text-[13px] text-kairo-copy leading-[1.8]">
                <div className="absolute top-[28px] right-0 left-[32px] translate-y-0 opacity-100 transition-all duration-300 ease-out group-hover/timeline-item:-translate-y-2 group-hover/timeline-item:opacity-0">
                  <div>{item.stats}</div>
                  {item.files?.map((file) => (
                    <div key={file}>{file}</div>
                  ))}
                </div>
                <p className="absolute top-[31px] right-0 left-[-22px] translate-y-3 border-kairo-yellow/65 border-l pl-[22px] text-[14px] leading-[1.75] opacity-0 transition-all duration-300 ease-out group-hover/timeline-item:translate-y-0 group-hover/timeline-item:opacity-100">
                  {item.note}
                </p>
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
