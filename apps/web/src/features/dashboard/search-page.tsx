import type { Session } from "@kairo/shared";
import { useNavigate } from "react-router-dom";

import { SearchPanel } from "@/features/search";

import { DashboardPageFrame } from "./dashboard-panels";

export function SearchPage() {
  const navigate = useNavigate();

  function selectSession(session: Session) {
    navigate(`/dashboard/sessions/${session.slug}`);
  }

  return (
    <DashboardPageFrame eyebrow="Search" title="Find a session">
      <div className="max-w-3xl">
        <SearchPanel onSelectSession={selectSession} />
      </div>
    </DashboardPageFrame>
  );
}
