import type { ComponentPropsWithoutRef } from "react";

import logoLg from "../../../../assets/general/logo.png";

import { cn } from "@/lib/utils";

type LogoVariant = "sm" | "lg";

type LogoProps = Omit<ComponentPropsWithoutRef<"a">, "children"> & {
  variant?: LogoVariant;
  imageClassName?: string;
};

const logoSource: Record<LogoVariant, string> = {
  sm: logoLg,
  lg: logoLg,
};

const logoSizeClass: Record<LogoVariant, string> = {
  sm: "h-[28px]",
  lg: "h-[46px]",
};

export function Logo({
  variant = "lg",
  className,
  imageClassName,
  href = "/",
  "aria-label": ariaLabel = "Kairo home",
  ...props
}: LogoProps) {
  return (
    <a
      aria-label={ariaLabel}
      className={cn("inline-flex items-center", className)}
      href={href}
      {...props}
    >
      <img
        alt="Kairo"
        className={cn("w-auto object-contain", logoSizeClass[variant], imageClassName)}
        decoding="async"
        draggable={false}
        src={logoSource[variant]}
      />
    </a>
  );
}
