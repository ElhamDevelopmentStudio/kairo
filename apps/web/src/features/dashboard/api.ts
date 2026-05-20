import type { SearchResponse, SessionDetailResponse, TimelineResponse } from "./types";

const DEFAULT_LIMIT = 200;

export async function fetchTimeline(limit = DEFAULT_LIMIT): Promise<TimelineResponse> {
  return fetchJson<TimelineResponse>(`/api/timeline?limit=${limit}`);
}

export async function fetchSessionDetail(slug: string): Promise<SessionDetailResponse> {
  return fetchJson<SessionDetailResponse>(`/api/sessions/${encodeURIComponent(slug)}`);
}

export async function searchSessions(query: string, limit = 20): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return fetchJson<SearchResponse>(`/api/search?${params.toString()}`);
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
