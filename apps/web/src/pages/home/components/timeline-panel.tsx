import { ArrowRight01Icon, File02Icon } from "@hugeicons/core-free-icons";

import { HugeIcon } from "@/components/huge-icon";

import { type TimelineItem, timelineItems } from "./timeline-data";

function TimelineDate({ item }: { item: TimelineItem }) {
  return (
    <div className="timeline-date">
      <div>{item.date}</div>
      <div className="timeline-time">{item.time}</div>
    </div>
  );
}

function TimelineMarker({
  item,
  index,
  isLast,
}: {
  item: TimelineItem;
  index: number;
  isLast: boolean;
}) {
  return (
    <div className="timeline-marker-cell">
      {index > 0 && <span className="timeline-rail timeline-rail-before" />}
      {!isLast && <span className="timeline-rail timeline-rail-after" />}
      <span className={`timeline-marker timeline-marker-${item.iconTone}`}>
        <HugeIcon icon={item.icon} className="timeline-marker-icon" />
      </span>
    </div>
  );
}

function TimelineSummary({ item }: { item: TimelineItem }) {
  return (
    <div className="timeline-summary">
      <h2 className="timeline-title">{item.title}</h2>
      <p className="timeline-description">{item.description}</p>
      <div className="timeline-badge">{item.badge}</div>
    </div>
  );
}

function TimelineDetails({ item }: { item: TimelineItem }) {
  return (
    <div className="timeline-details">
      <div className="timeline-metadata">
        <div>{item.stats}</div>
        {item.files?.map((file) => (
          <div key={file}>{file}</div>
        ))}
      </div>
      <p className="timeline-note">{item.note}</p>
    </div>
  );
}

function TimelineRow({
  item,
  index,
  isLast,
}: {
  item: TimelineItem;
  index: number;
  isLast: boolean;
}) {
  return (
    <article className="timeline-row">
      <TimelineDate item={item} />
      <TimelineMarker index={index} isLast={isLast} item={item} />
      <TimelineSummary item={item} />
      <TimelineDetails item={item} />
    </article>
  );
}

function TimelineFooter() {
  return (
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
  );
}

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
            <TimelineRow
              index={index}
              isLast={index === timelineItems.length - 1}
              item={item}
              key={`${item.date}-${item.title}`}
            />
          ))}
        </div>
      </div>

      <TimelineFooter />
    </section>
  );
}
