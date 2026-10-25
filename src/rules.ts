import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "node:path";
export const MODES = [
  "allow-fallback",
  "bare-deny",
  "scoped-deny",
  "wildcard-deny",
  "mcp-glob",
  "path-deny",
  "project-settings",
  "reviewer-dontAsk",
  "bypass-unlisted",
] as const;
export type Mode = (typeof MODES)[number];
export type Outcome = "execute" | "block" | "mixed";
export interface RunConfig {
  mode: Mode;
  prediction?: Outcome;
}
export interface Scenario {
  stage: string;
  outcome: Outcome;
  mode: NonNullable<Options["permissionMode"]>;
  allowed: string[];
  denied: string[];
  tools: string[];
  mcp?: boolean;
  project?: boolean;
}
export const SCENARIOS: Record<Mode, Scenario> = {
  "allow-fallback": {
    stage: "Allow pre-approval plus callback fallback",
    outcome: "mixed",
    mode: "default",
    allowed: ["Read"],
    denied: [],
    tools: ["Read", "Write"],
  },
  "bare-deny": {
    stage: "Bare deny removes Write",
    outcome: "execute",
    mode: "default",
    allowed: ["Read"],
    denied: ["Write"],
    tools: ["Read", "Write"],
  },
  "scoped-deny": {
    stage: "Scoped Bash deny matches the attempted command",
    outcome: "block",
    mode: "bypassPermissions",
    allowed: ["Bash(rm *)"],
    denied: ["Bash(rm *)"],
    tools: ["Bash"],
  },
  "wildcard-deny": {
    stage: "MCP wildcard deny; verify actual runtime evidence",
    outcome: "mixed",
    mode: "default",
    allowed: ["Read"],
    denied: ["mcp__*"],
    tools: ["Read"],
    mcp: true,
  },
  "mcp-glob": {
    stage: "Literal-server MCP allow glob",
    outcome: "mixed",
    mode: "default",
    allowed: ["mcp__classroom__read_*"],
    denied: [],
    tools: [],
    mcp: true,
  },
  "path-deny": {
    stage: "Edit(path) governs Write",
    outcome: "mixed",
    mode: "default",
    allowed: ["Write"],
    denied: ["Edit(./protected/**)"],
    tools: ["Write"],
  },
  "project-settings": {
    stage: "Project allow, deny and ask rules",
    outcome: "mixed",
    mode: "default",
    allowed: [],
    denied: [],
    tools: ["Read", "Write"],
    project: true,
  },
  "reviewer-dontAsk": {
    stage: "Pre-approved reviewer plus dontAsk",
    outcome: "mixed",
    mode: "dontAsk",
    allowed: ["Read", "Glob", "Grep"],
    denied: [],
    tools: ["Read", "Glob", "Grep", "Write"],
  },
  "bypass-unlisted": {
    stage: "Bypass approves an unlisted Write",
    outcome: "execute",
    mode: "bypassPermissions",
    allowed: ["Read"],
    denied: [],
    tools: ["Read", "Write"],
  },
};
export const PROJECT_RULES = {
  permissions: { allow: ["Read"], deny: ["Read(./.env)"], ask: ["Write"] },
};
export function validateConfig(value: unknown): RunConfig {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !MODES.includes((value as RunConfig).mode)
  )
    throw new Error("Choose a listed allow/deny experiment.");
  const c = value as RunConfig;
  if (
    c.prediction !== undefined &&
    !["execute", "block", "mixed"].includes(c.prediction)
  )
    throw new Error("Choose execute, block or mixed.");
  return {
    mode: c.mode,
    ...(c.prediction ? { prediction: c.prediction } : {}),
  };
}
export function hostAllows(
  cwd: string,
  mode: Mode,
  name: string,
  input: Record<string, unknown>,
) {
  if (mode === "scoped-deny") {
    const target = resolve(cwd, "permission-target.txt").replaceAll("\\", "/");
    return (
      name === "Bash" &&
      [
        "rm -f permission-target.txt",
        `rm -f "${target}"`,
        `rm -f '${target}'`,
        `rm -f ${target}`,
      ].includes(String(input.command).replaceAll("\\", "/"))
    );
  }
  if (
    mode === "mcp-glob" ||
    (mode === "wildcard-deny" && name.startsWith("mcp__"))
  )
    return [
      "mcp__classroom__read_lesson",
      "mcp__archive__read_lesson",
    ].includes(name);
  const path =
    typeof input.file_path === "string" ? resolve(cwd, input.file_path) : "";
  if (name === "Read")
    return (
      path === resolve(cwd, "lesson.txt") ||
      (mode === "project-settings" && path === resolve(cwd, ".env"))
    );
  if (name === "Write")
    return (
      input.content === "RULES-28\n" &&
      (path === resolve(cwd, "result.txt") ||
        (mode === "path-deny" && path === resolve(cwd, "protected/report.txt")))
    );
  return false;
}
