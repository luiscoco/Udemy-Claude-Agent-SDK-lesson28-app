// Browser-safe event types; do not import Node-side rule evaluation here.
export type Mode = 'allow-fallback'|'bare-deny'|'scoped-deny'|'wildcard-deny'|
 'mcp-glob'|'path-deny'|'project-settings'|'reviewer-dontAsk'|'bypass-unlisted';
export interface RunConfig {mode:Mode;prediction?:'execute'|'block'|'mixed'}
export interface Trace {
  phase: "hook" | "callback" | "post";
  tool: string;
  decision: string;
  reason?: string;
}
export interface Evidence {
  mode: Mode;
  prediction?: string;
  predictedCorrect?: boolean;
  expectedStage: string;
  expectedOutcome: string;
  observedOutcome: string;
  fileCreated: boolean;
  fileContents: string | null;
  protectedFixtureUnchanged: boolean;
  trace: Trace[];
  completed: string[];
  callbackCalls: number;
  warningCodes: string[];
  nativeErrors: number;
  inventory: string[];
  mcpHandlerCalls: string[];
  projectSettingsLoaded: boolean;
  protectedWriteCreated: boolean;
  protectedEnvUnchanged: boolean;
}
export type LabEvent =
  | { type: "options"; config: RunConfig; options: unknown }
  | { type: "configuration"; files: { name: string; contents: string }[] }
  | { type: "initialized"; model: string; sessionId: string; tools: string[] }
  | { type: "trace"; entry: Trace }
  | { type: "message"; sdkType: string; summary: string }
  | { type: "tool"; name: string; args: unknown }
  | { type: "native-result"; name: string; isError: boolean; content: unknown }
  | { type: "warning"; code: string; explanation: string }
  | { type: "answer"; text: string }
  | { type: "result"; status: string; text: string; costUsd: number }
  | ({ type: "evidence" } & Evidence)
  | { type: "error" | "notice"; text: string };
