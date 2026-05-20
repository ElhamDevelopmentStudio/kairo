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
  active?: boolean;
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
  },
  {
    date: "APR 11",
    time: "10:21",
    title: "Architecture shift",
    description: "Monolith -> Service layer refactor",
    icon: CubeIcon,
    iconTone: "yellow",
    badge: "MAJOR ARCHITECTURAL EVOLUTION",
    note: "Extracted core domain logic into dedicated services. Improved separation of concerns and testability across boundaries.",
    active: true,
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
  },
];
