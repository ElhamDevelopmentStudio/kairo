import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <a
      className={cn("flex items-center gap-4 text-kairo-white", className)}
      href="/"
      aria-label="Kairo home"
    >
      <span className="kairo-mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="font-sans text-[28px] tracking-[0.34em]">KAIRO</span>
    </a>
  );
}
