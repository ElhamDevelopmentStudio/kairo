import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

import { cn } from "@/lib/utils";

type HugeIconProps = {
  icon: IconSvgElement;
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
};

export function HugeIcon({ icon, className, strokeWidth = 1.7, ...props }: HugeIconProps) {
  return (
    <HugeiconsIcon
      icon={icon}
      size="1em"
      strokeWidth={strokeWidth}
      className={cn("size-4", className)}
      {...props}
    />
  );
}
