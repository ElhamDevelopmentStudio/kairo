import { useMutation, useQuery } from "@tanstack/react-query";

import {
  askProjectMemory,
  fetchArchitectureShifts,
  fetchHealth,
  fetchSessionDetail,
  fetchSessions,
  fetchTimeline,
  searchSessions,
} from "./api";

export const dashboardQueryKeys = {
  architecture: ["dashboard", "architecture"] as const,
  health: ["dashboard", "health"] as const,
  search: (query: string) => ["dashboard", "search", query] as const,
  session: (slug: string) => ["dashboard", "session", slug] as const,
  sessions: ["dashboard", "sessions"] as const,
  timeline: ["dashboard", "timeline"] as const,
};

export function useAskProjectMemory() {
  return useMutation({
    mutationFn: askProjectMemory,
  });
}

export function useProjectHealth() {
  return useQuery({
    queryFn: fetchHealth,
    queryKey: dashboardQueryKeys.health,
  });
}

export function useTimeline() {
  return useQuery({
    queryFn: () => fetchTimeline(200),
    queryKey: dashboardQueryKeys.timeline,
  });
}

export function useSessions() {
  return useQuery({
    queryFn: () => fetchSessions(200),
    queryKey: dashboardQueryKeys.sessions,
  });
}

export function useSessionDetail(slug: string | undefined) {
  return useQuery({
    enabled: slug !== undefined,
    queryFn: () => fetchSessionDetail(slug ?? ""),
    queryKey: dashboardQueryKeys.session(slug ?? ""),
  });
}

export function useSessionSearch(query: string) {
  const trimmed = query.trim();

  return useQuery({
    enabled: trimmed.length > 0,
    queryFn: () => searchSessions(trimmed, 20),
    queryKey: dashboardQueryKeys.search(trimmed),
  });
}

export function useArchitectureShifts() {
  return useQuery({
    queryFn: () => fetchArchitectureShifts(100),
    queryKey: dashboardQueryKeys.architecture,
  });
}
