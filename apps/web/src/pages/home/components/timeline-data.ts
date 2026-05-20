import {
  CodeIcon,
  CubeIcon,
  Database02Icon,
  GitBranchIcon,
  NodeMoveDownIcon,
  TerminalIcon,
  ZapIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

export type TimelineItem = {
  date: string;
  time: string;
  title: string;
  description: string;
  icon: IconSvgElement;
  iconTone: "neutral" | "green" | "blue" | "purple" | "yellow";
  stats?: string;
  files?: string[];
  badge?: string;
  note?: string;
};

export const timelineItems: TimelineItem[] = [
  {
    date: "MAR 10",
    time: "09:14",
    title: "Initial scaffolding",
    description: "Project setup and core infrastructure",
    icon: TerminalIcon,
    iconTone: "neutral",
    stats: "+ 42   /  - 0",
    files: ["apps/web, packages/core", "tsconfig.json"],
    badge: "PROJECT FOUNDATION",
    note: "Established the application shell and core package boundaries so later work could build on stable contracts.",
  },
  {
    date: "MAR 18",
    time: "14:32",
    title: "Authentication system added",
    description: "Implemented JWT auth with refresh rotation",
    icon: GitBranchIcon,
    iconTone: "green",
    stats: "+ 128  /  - 6",
    files: ["packages/auth", "src/middleware/auth.ts"],
    badge: "SECURITY BOUNDARY ADDED",
    note: "Introduced authenticated request flow and refresh handling, changing how user context moves through the system.",
  },
  {
    date: "MAR 27",
    time: "11:07",
    title: "Database migration",
    description: "Moved from SQLite to PostgreSQL",
    icon: Database02Icon,
    iconTone: "blue",
    stats: "+ 76   /  - 34",
    files: ["packages/db", "migrations/20240327.sql"],
    badge: "PERSISTENCE LAYER SHIFT",
    note: "Moved state into a relational backend and created migration history for repeatable environment setup.",
  },
  {
    date: "APR 02",
    time: "16:44",
    title: "Background jobs",
    description: "Added job processing with BullMQ",
    icon: NodeMoveDownIcon,
    iconTone: "purple",
    stats: "+ 93   /  - 8",
    files: ["packages/queue", "src/worker/processor.ts"],
    badge: "ASYNC EXECUTION ADDED",
    note: "Moved long-running processing behind workers so request paths stay responsive and retryable.",
  },
  {
    date: "APR 11",
    time: "10:21",
    title: "Architecture shift",
    description: "Monolith -> Service layer refactor",
    icon: CubeIcon,
    iconTone: "yellow",
    stats: "+ 84   /  - 29",
    files: ["packages/domain", "src/services/project.ts"],
    badge: "MAJOR ARCHITECTURAL EVOLUTION",
    note: "Extracted core domain logic into dedicated services. Improved separation of concerns and testability across boundaries.",
  },
  {
    date: "APR 16",
    time: "13:55",
    title: "API layer refactor",
    description: "Standardized responses and error handling",
    icon: CodeIcon,
    iconTone: "purple",
    stats: "+ 61   /  - 18",
    files: ["packages/api", "src/lib/response.ts"],
    badge: "API CONTRACT NORMALIZED",
    note: "Standardized response envelopes and error handling so clients receive predictable success and failure shapes.",
  },
  {
    date: "APR 22",
    time: "08:41",
    title: "Caching layer",
    description: "Added Redis caching for hot paths",
    icon: ZapIcon,
    iconTone: "neutral",
    stats: "+ 31   /  - 2",
    files: ["packages/cache", "src/cache/redis.ts"],
    badge: "HOT PATH OPTIMIZATION",
    note: "Added cache boundaries around repeated reads to reduce latency while keeping invalidation isolated.",
  },
];
