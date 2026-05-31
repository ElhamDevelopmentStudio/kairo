export { Workspace } from "./workspace/index.ts";
export type {
  WorkspaceAiAuthMode,
  WorkspaceAiAuthModeType,
  WorkspaceAiConfig,
  WorkspaceAiConfigType,
  WorkspaceConfig,
  WorkspaceConfigType,
  WorkspaceInitOptions,
} from "./workspace/index.ts";
export { detectArchitectureShifts } from "./architecture/index.ts";
export type { ArchitectureDetectorInput } from "./architecture/index.ts";
export { EventStore } from "./event-store/index.ts";
export {
  answerProjectMemory,
  extractDecisionMemories,
  generateSessionBridgeDocuments,
  rebuildMemoryRecords,
  sessionBridgeSearchText,
} from "./memory/index.ts";
export { buildKnowledgeGraph, queryKnowledgeGraph } from "./knowledge-graph/index.ts";
export type { BuildKnowledgeGraphInput, KnowledgeGraphQuery } from "./knowledge-graph/index.ts";
export type {
  AnswerProjectMemoryOptions,
  ExtractDecisionMemoriesInput,
  RebuildMemoryRecordsInput,
  SessionBridgeDocument,
  SessionBridgeInput,
} from "./memory/index.ts";
export { extractProblemMemories } from "./problem-memory/index.ts";
export {
  installKairoHooks,
  mergeKairoHooks,
  removeKairoHooks,
  uninstallKairoHooks,
} from "./hooks/index.ts";
export { GitObserver, GitTailer, FileObserver } from "./observers/index.ts";
export type { FileEventHandler } from "./observers/file/index.ts";
export type { GitEventHandler, GitTailerOptions } from "./observers/git/index.ts";
export { redactSecrets, redactString } from "./redact/index.ts";
export { renderSession, renderTimeline } from "./render/index.ts";
export {
  indexSessionEmbeddings,
  semanticSearchSessions,
  sessionSearchContentHash,
  sessionSearchText,
} from "./search/index.ts";
export type { SemanticSearchResult, TextEmbedder, TextEmbedding } from "./search/index.ts";
export { LiveSession, SessionReconstructor, bucketize } from "./session-reconstructor/index.ts";
export type {
  FinalizedSession,
  LiveSessionOptions,
  SessionReconstructorOptions,
} from "./session-reconstructor/index.ts";
