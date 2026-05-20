import { HeroPanel } from "./components/hero-panel";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { TimelinePanel } from "./components/timeline-panel";

export function HomePage() {
  return (
    <main className="home-screen">
      <SiteHeader />
      <div className="home-shell">
        <HeroPanel />
        <TimelinePanel />
      </div>
      <SiteFooter />
    </main>
  );
}
