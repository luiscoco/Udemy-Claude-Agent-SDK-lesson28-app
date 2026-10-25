import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { join } from "node:path";
import {
  validateConfig,
  MODES,
  SCENARIOS,
  PROJECT_RULES,
  hostAllows,
  type Mode,
  type RunConfig,
} from "./rules.js";
import { prepareWorkspace } from "./workspace.js";
import { createClassroomServers } from "./classroom-tools.js";
import type { LabEvent, Trace, Evidence } from "./protocol.js";
export { MODES, validateConfig };
export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
export const DEFAULT_CONFIG: RunConfig = {
  mode: "allow-fallback",
  prediction: "mixed",
};
const readWrite =
  "Read lesson.txt once, then attempt Write once to result.txt with exactly RULES-28 followed by a single newline. If Write is unavailable, do not fabricate a call. If denied, stop that operation without retry or workaround. Briefly report actual outcomes.";
export const PROMPTS: Record<Mode, string> = {
  "allow-fallback": readWrite,
  "bare-deny": readWrite,
  "scoped-deny":
    "Attempt Bash exactly once with command rm -f permission-target.txt. This is a disposable classroom fixture. Accept denial without retry, command changes or another tool. Briefly report the actual result.",
  "wildcard-deny":
    "Read lesson.txt once. Then attempt archive read_lesson once and classroom read_lesson once if these definitions are available. Accept any denial without retry or workaround. Do not fabricate calls to unavailable tools. Briefly report the actual outcomes and lesson marker.",
  "mcp-glob":
    "Call classroom read_lesson once, then attempt archive read_lesson once. Accept any denial without retry or another tool. Briefly identify which call actually completed and report the actual lesson marker.",
  "path-deny":
    "Attempt Write once to protected/report.txt, then once to result.txt. Both contents must be exactly RULES-28 followed by a single newline. If the protected write is denied, accept it and continue only with the separate result.txt task. No retry or workaround. Briefly report actual results.",
  "project-settings":
    "Read lesson.txt once. Attempt Read once on the classroom .env file in this disposable working directory; it contains only a mock teaching value, not a real credential. Accept any denial. Then attempt Write once to result.txt with exactly RULES-28 followed by a single newline. No retry, alternate paths or workarounds. Briefly report actual outcomes.",
  "reviewer-dontAsk": readWrite,
  "bypass-unlisted": readWrite,
};
export function redact(text: string) {
  for (const value of [
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_AUTH_TOKEN,
  ].filter(Boolean) as string[])
    text = text.split(value).join("[REDACTED]");
  return text.replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED]").slice(0, 22000);
}
export async function runAgent(
  config: RunConfig,
  emit: (e: LabEvent) => void,
  controller = new AbortController(),
) {
  const c = validateConfig(config),
    s = SCENARIOS[c.mode],
    workspace = await prepareWorkspace(Boolean(s.project));
  const trace: Trace[] = [],
    completed: string[] = [],
    warningCodes: string[] = [],
    mcpHandlerCalls: string[] = [];
  const record = (entry: Trace) => {
    trace.push(entry);
    emit({ type: "trace", entry });
  };
  const servers = s.mcp
    ? createClassroomServers(workspace.cwd, (name) =>
        mcpHandlerCalls.push(name),
      )
    : {};
  let nativeErrors = 0,
    inventory: string[] = [];
  const options: Options = {
    model: MODEL,
    cwd: workspace.cwd,
    tools: s.tools,
    mcpServers: servers,
    allowedTools: s.allowed,
    disallowedTools: s.denied,
    settingSources: s.project ? ["project"] : [],
    skills: [],
    plugins: [],
    strictMcpConfig: true,
    permissionMode: s.mode,
    allowDangerouslySkipPermissions: s.mode === "bypassPermissions",
    persistSession: false,
    effort: "low",
    thinking: { type: "disabled" },
    maxTurns: 8,
    maxBudgetUsd: 0.4,
    abortController: controller,
    env: {
      ...process.env,
      HOME: workspace.home,
      USERPROFILE: workspace.home,
      CLAUDE_CONFIG_DIR: workspace.sdkHome,
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      ENABLE_CLAUDEAI_MCP_SERVERS: "false",
      ENABLE_TOOL_SEARCH: "false",
    },
    systemPrompt:
      "Perform this bounded classroom rule experiment using real tools. Attempt each requested available tool exactly once even if it may be denied. An unavailable tool cannot be called: never fabricate tool calls. Do not retry denials, change command spellings, use alternate paths or bypass a rejection. Keep the final explanation brief.",
    hooks: {
      PreToolUse: [
        {
          hooks: [
            async (input) => {
              if (input.hook_event_name !== "PreToolUse") return {};
              const pass = hostAllows(
                workspace.cwd,
                c.mode,
                input.tool_name,
                input.tool_input as Record<string, unknown>,
              );
              record({
                phase: "hook",
                tool: input.tool_name,
                decision: pass ? "pass" : "deny",
              });
              return pass
                ? {}
                : {
                    hookSpecificOutput: {
                      hookEventName: "PreToolUse",
                      permissionDecision: "deny",
                      permissionDecisionReason:
                        "Outside the fixed disposable classroom task.",
                    },
                  };
            },
          ],
        },
      ],
      PostToolUse: [
        {
          hooks: [
            async (input) => {
              if (input.hook_event_name === "PostToolUse") {
                completed.push(input.tool_name);
                record({
                  phase: "post",
                  tool: input.tool_name,
                  decision: "completed",
                });
              }
              return {};
            },
          ],
        },
      ],
    },
    canUseTool: async (name, input) => {
      const allow =
        c.mode === "project-settings" &&
        name === "Write" &&
        hostAllows(workspace.cwd, c.mode, name, input);
      record({
        phase: "callback",
        tool: name,
        decision: allow ? "allow" : "deny",
      });
      return allow
        ? { behavior: "allow", updatedInput: input }
        : {
            behavior: "deny",
            message:
              "Classroom policy denies unresolved calls. Accept the denial without retry or workaround.",
          };
    },
  };
  emit({
    type: "configuration",
    files: [
      {
        name: s.project
          ? "Actual .claude/settings.json"
          : "Actual options rules",
        contents: JSON.stringify(
          s.project
            ? PROJECT_RULES
            : {
                allowedTools: s.allowed,
                disallowedTools: s.denied,
                permissionMode: s.mode,
              },
          null,
          2,
        ),
      },
    ],
  });
  emit({
    type: "options",
    config: c,
    options: {
      model: MODEL,
      tools: s.tools,
      mcpServers: Object.keys(servers),
      allowedTools: s.allowed,
      disallowedTools: s.denied,
      settingSources: options.settingSources,
      permissionMode: s.mode,
      allowDangerouslySkipPermissions: options.allowDangerouslySkipPermissions,
      referenceStage: s.stage,
      expectedOutcome: s.outcome,
      cwd: "fresh disposable classroom directory",
    },
  });
  const warningListener = (warning: Error) => {
    const code = (warning as NodeJS.ErrnoException).code;
    if (code === "CLAUDE_SDK_CAN_USE_TOOL_SHADOWED") {
      warningCodes.push(code);
      emit({
        type: "warning",
        code,
        explanation:
          "Some configured calls can be resolved before canUseTool. Inspect actual events to determine the outcome.",
      });
    }
  };
  process.on("warning", warningListener);
  const paths = [
    "lesson.txt",
    "result.txt",
    "protected/report.txt",
    ".env",
  ].map((file) => join(workspace.cwd, file));
  const run = query({
    prompt:
      PROMPTS[c.mode] +
      `\nClassroom cwd: ${workspace.cwd}\nUse these absolute file paths for requested operations:\n${paths.join("\n")}`,
    options,
  });
  const names = new Map<string, string>();
  try {
    for await (const message of run) {
      emit({
        type: "message",
        sdkType: message.type,
        summary:
          "subtype" in message ? String(message.subtype) : "Actual SDK message",
      });
      if (message.type === "system" && message.subtype === "init") {
        inventory = message.tools;
        emit({
          type: "initialized",
          model: message.model,
          sessionId: message.session_id,
          tools: message.tools,
        });
      }
      if (message.type === "assistant")
        for (const block of message.message.content) {
          if (block.type === "text")
            emit({ type: "answer", text: redact(block.text) });
          if (block.type === "tool_use") {
            names.set(block.id, block.name);
            emit({ type: "tool", name: block.name, args: block.input });
          }
        }
      if (message.type === "user" && Array.isArray(message.message.content))
        for (const block of message.message.content)
          if (block.type === "tool_result") {
            if (block.is_error) nativeErrors++;
            emit({
              type: "native-result",
              name: names.get(block.tool_use_id) || block.tool_use_id,
              isError: Boolean(block.is_error),
              content: JSON.parse(redact(JSON.stringify(block.content))),
            });
          }
      if (message.type === "result")
        emit({
          type: "result",
          status:
            message.subtype === "success"
              ? message.is_error
                ? "error"
                : "success"
              : message.subtype,
          text: redact(
            message.subtype === "success"
              ? message.result
              : message.errors.join("\n"),
          ),
          costUsd: message.total_cost_usd,
        });
    }
    const files = await workspace.inspect();
    const observedOutcome = completed.length
      ? nativeErrors
        ? "mixed"
        : "execute"
      : "block";
    const evidence: Evidence = {
      mode: c.mode,
      prediction: c.prediction,
      predictedCorrect: c.prediction
        ? c.prediction === observedOutcome
        : undefined,
      expectedStage: s.stage,
      expectedOutcome: s.outcome,
      observedOutcome,
      ...files,
      trace,
      completed,
      callbackCalls: trace.filter((e) => e.phase === "callback").length,
      warningCodes,
      nativeErrors,
      inventory,
      mcpHandlerCalls,
      projectSettingsLoaded: Boolean(s.project),
    };
    emit({ type: "evidence", ...evidence });
  } finally {
    run.close();
    process.off("warning", warningListener);
    await workspace.cleanup();
  }
}
