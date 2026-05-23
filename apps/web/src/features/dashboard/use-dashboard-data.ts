import type { ArchitectureShift, Session } from "@kairo/shared";
import { createContext, useContext } from "react";

interface DashboardData {
  architectureShifts: ArchitectureShift[];
  error: string | null;
  isTimelineLoading: boolean;
  sessions: Session[];
}

export const DashboardDataContext = createContext<DashboardData | null>(null);

export function useDashboardData(): DashboardData {
  const data = useContext(DashboardDataContext);

  if (data === null) {
    throw new Error("Dashboard data is only available inside DashboardPage.");
  }

  return data;
}
