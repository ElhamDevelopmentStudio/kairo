import {
  ArchitectureShift as ArchitectureShiftSchema,
  KairoEvent as KairoEventSchema,
  Session as SessionSchema,
} from "@kairo/shared";
import type { ArchitectureShift, KairoEvent, Session } from "@kairo/shared";
import axios from "axios";
import { z } from "zod";

const client = axios.create({
  headers: {
    Accept: "application/json",
  },
});

const HealthResponseSchema = z.object({
  ok: z.boolean(),
  projectName: z.string(),
});

const TimelineResponseSchema = z.object({
  sessions: z.array(SessionSchema),
  architectureShifts: z.array(ArchitectureShiftSchema),
});

const SessionsResponseSchema = z.object({
  sessions: z.array(SessionSchema),
});

const SessionDetailResponseSchema = z.object({
  session: SessionSchema,
  events: z.array(KairoEventSchema),
  markdown: z.string(),
});

const SearchResponseSchema = SessionsResponseSchema;

const ArchitectureShiftsResponseSchema = z.object({
  architectureShifts: z.array(ArchitectureShiftSchema),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export interface TimelineResponse {
  sessions: Session[];
  architectureShifts: ArchitectureShift[];
}

export interface SessionsResponse {
  sessions: Session[];
}

export interface SessionDetailResponse {
  session: Session;
  events: KairoEvent[];
  markdown: string;
}

export type SearchResponse = SessionsResponse;

export interface ArchitectureShiftsResponse {
  architectureShifts: ArchitectureShift[];
}

export async function fetchHealth(): Promise<HealthResponse> {
  return parseResponse("/api/health", HealthResponseSchema);
}

export async function fetchTimeline(limit = 200): Promise<TimelineResponse> {
  return parseResponse(`/api/timeline?limit=${limit}`, TimelineResponseSchema);
}

export async function fetchSessions(limit = 200): Promise<SessionsResponse> {
  return parseResponse(`/api/sessions?limit=${limit}`, SessionsResponseSchema);
}

export async function fetchSessionDetail(slug: string): Promise<SessionDetailResponse> {
  return parseResponse(`/api/sessions/${encodeURIComponent(slug)}`, SessionDetailResponseSchema);
}

export async function searchSessions(query: string, limit = 20): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return parseResponse(`/api/search?${params.toString()}`, SearchResponseSchema);
}

export async function fetchArchitectureShifts(limit = 100): Promise<ArchitectureShiftsResponse> {
  return parseResponse(`/api/architecture-shifts?limit=${limit}`, ArchitectureShiftsResponseSchema);
}

async function parseResponse<T>(path: string, schema: z.ZodTypeAny): Promise<T> {
  const response = await client.get<unknown>(path);
  return schema.parse(response.data) as T;
}
