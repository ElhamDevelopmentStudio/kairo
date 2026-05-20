import { HeroPanel } from "./components/hero-panel";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { TimelinePanel } from "./components/timeline-panel";

export function HomePage() {
  return (
    <main className="home-screen">
      <SiteHeader />
      <div className="relative z-[1] flex min-h-[1024px] max-[1100px]:min-h-auto max-[1100px]:flex-col max-[1100px]:pt-[118px]">
        <HeroPanel />
        <TimelinePanel />
      </div>
      <SiteFooter />
    </main>
  );
}
