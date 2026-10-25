# Claude Agent SDK · Lesson 28 · Allow and deny rules

Five linked student pages, large text, actual SDK experiments and coloured code in all thirteen UML steps.

## What you will learn

- Use allow entries as pre-approval: allowedTools adds allow rules; it is not a complete inventory or a universal whitelist. The default experiment leaves Write available and sends that unlisted call to a denying callback. Reads inside the working directory can also be safe built-in approvals.
- Distinguish removal from runtime denial: A bare Write deny removes that definition. A scoped Bash(rm *) deny keeps Bash available and rejects matching calls as written. The live shell experiment uses one disposable fixture and an independent exact-operation guard.
- Match MCP globs correctly: An allow glob needs a literal server prefix, such as mcp__classroom__read_*. The live call on that server succeeds while the archive server call reaches the callback and is denied. The wildcard experiment verifies denied MCP execution while Read succeeds. In this pinned runtime MCP names remain in the reported snapshot, so inspect actual denial feedback.
- Protect writes using Edit path rules: The live Edit(./protected/**) deny protects a directory even though the model requests Write. A separate Write to result.txt succeeds. Reference notes distinguish relative, single-slash source-anchored and double-slash absolute patterns; Write(path) is not an equivalent scoped write rule.
- Load declarative project rules: The project experiment writes an actual .claude/settings.json in a fresh classroom directory and enables settingSources project. Its allow permits Read, deny protects a mock .env read and ask sends Write to the programmed callback.
- Compare dontAsk with bypass: The reviewer pre-approves Read/Glob/Grep and uses dontAsk, so its attempted Write is denied without a callback. With bypass and only Read in allowedTools, an unlisted Write executes. Verify actual native results and host file checks.

## Configure and run

```powershell
git clone https://github.com/luiscoco/Udemy-Claude-Agent-SDK-lesson28-app.git
cd .\Udemy-Claude-Agent-SDK-lesson28-app
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm start
```

From presentations use `cd .\agent-sdk\lesson28-allow-deny-rules`. Open http://127.0.0.1:3128 and keep the terminal running. Node.js 24+, API credit and model access are required. Windows may require Git Bash.

## Create your .env file

Preserve an existing file. Enter your own model key, then restart. Existing shell values take precedence.

```dotenv
ANTHROPIC_API_KEY=your_api_key
CLAUDE_MODEL=claude-sonnet-4-6
PORT=3128
# Windows if needed: CLAUDE_CODE_GIT_BASH_PATH=C:/Program Files/Git/bin/bash.exe

```

No GitHub token or Managed Agents IDs are required. Secrets, dependencies and teaching media stay outside Git.

## Run the experiments

### Compare the four rule forms

Run allow fallback, bare deny, scoped deny and MCP wildcard deny. Check whether a tool is absent from the reported inventory or actually attempted and rejected.

```powershell
npm run sample:env -- allow-fallback
npm run sample:env -- bare-deny
npm run sample:env -- scoped-deny
npm run sample:env -- wildcard-deny
```

### Compare MCP globs, paths and project settings

Run the remaining rule experiments. Inspect the literal-server glob, protected Write denial and actual project allow/deny/ask behavior. The callback allows only the fixed classroom output in project mode.

```powershell
npm run sample:env -- mcp-glob
npm run sample:env -- path-deny
npm run sample:env -- project-settings
```

### Compare reviewer dontAsk with bypass

Both modes keep Write available. The reviewer denies it without a callback; bypass permits the unlisted write. Compare actual outputs instead of treating allowedTools as a universal restriction.

```powershell
npm run sample:env -- reviewer-dontAsk
npm run sample:env -- bypass-unlisted
npm test
```

## How the app was built

### 1. Validate the fixed rule experiment

Only listed modes and three prediction outcomes are accepted. The browser cannot supply arbitrary permission rules or tool commands.

Source: `src/rules.ts`, selected lines 110–116. Surrounding code omitted.

```typescript
export function validateConfig(value: unknown): RunConfig {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !MODES.includes((value as RunConfig).mode)
  )
```

### 2. Create disposable fixtures and settings

Project mode writes actual declarative rules into .claude/settings.json in a fresh working directory. The separate mock .env contains only an explicit classroom value.

Source: `src/workspace.ts`, selected lines 32–38. Surrounding code omitted.

```typescript
if (project) {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    await writeFile(
      join(cwd, ".claude/settings.json"),
      JSON.stringify(PROJECT_RULES, null, 2),
      "utf-8",
    );
```

### 3. Pass allow and deny options

Allow entries pre-approve matching calls. A bare deny removes the tool definition; a scoped deny leaves it available for a matching runtime rejection.

Source: `src/agent.ts`, selected lines 75–79. Surrounding code omitted.

```typescript
allowedTools: s.allowed,
    disallowedTools: s.denied,
    settingSources: s.project ? ["project"] : [],
    skills: [],
    plugins: [],
```

### 4. Enable the project setting source

The project source must be enabled for the generated settings file to contribute allow, deny and ask rules. Other experiments use an empty settings-source list.

Source: `src/agent.ts`, selected lines 77–80. Surrounding code omitted.

```typescript
settingSources: s.project ? ["project"] : [],
    skills: [],
    plugins: [],
    strictMcpConfig: true,
```

### 5. Protect writes with an Edit path rule

The live relative Edit path rule governs a model Write to protected/report.txt. An independent Write to result.txt remains eligible for approval.

Source: `src/rules.ts`, selected lines 73–80. Surrounding code omitted.

```typescript
"path-deny": {
    stage: "Edit(path) governs Write",
    outcome: "mixed",
    mode: "default",
    allowed: ["Write"],
    denied: ["Edit(./protected/**)"],
    tools: ["Write"],
  },
```

### 6. Register local MCP servers

Two literal server names expose real read_lesson handlers. The classroom allow glob matches one server; the archive call remains a separate permission decision.

Source: `src/classroom-tools.ts`, selected lines 8–15. Surrounding code omitted.

```typescript
return Object.fromEntries(
    ["classroom", "archive"].map((name) => [
      name,
      createSdkMcpServer({
        name,
        version: "1.0.0",
        tools: [
          tool(
```

### 7. Pass bounded operations without approving

The host guard narrows inputs to this exercise, then returns no permission decision for valid operations. This lets SDK allow and deny rules produce the observed outcome.

Source: `src/agent.ts`, selected lines 106–113. Surrounding code omitted.

```typescript
const pass = hostAllows(
                workspace.cwd,
                c.mode,
                input.tool_name,
                input.tool_input as Record<string, unknown>,
              );
              record({
                phase: "hook",
```

### 8. Resolve remaining calls in the callback

Only the project-settings Write is allowed here. Other unresolved requests are denied. Compare a callback rejection with an absent tool or an automatic mode approval.

Source: `src/agent.ts`, selected lines 149–156. Surrounding code omitted.

```typescript
canUseTool: async (name, input) => {
      const allow =
        c.mode === "project-settings" &&
        name === "Write" &&
        hostAllows(workspace.cwd, c.mode, name, input);
      record({
        phase: "callback",
        tool: name,
```

### 9. Start the actual SDK query

Each query uses its fresh directory and fixed tasks. Tools that were removed cannot be requested; the model must not fabricate an unavailable call.

Source: `src/agent.ts`, selected lines 225–229. Surrounding code omitted.

```typescript
const run = query({
    prompt:
      PROMPTS[c.mode] +
      `\nClassroom cwd: ${workspace.cwd}\nUse these absolute file paths for requested operations:\n${paths.join("\n")}`,
    options,
```

### 10. Observe the actual tool inventory

Preserve reported initialization names and compare them with actual attempts, native denials and MCP handler execution. Bare Write removal and MCP wildcard behavior differ in the pinned runtime.

Source: `src/agent.ts`, selected lines 241–246. Surrounding code omitted.

```typescript
inventory = message.tools;
        emit({
          type: "initialized",
          model: message.model,
          sessionId: message.session_id,
          tools: message.tools,
```

### 11. Preserve native rejection evidence

A denied operation yields native feedback. A successful final model explanation does not establish that every requested operation executed.

Source: `src/agent.ts`, selected lines 261–267. Surrounding code omitted.

```typescript
if (block.is_error) nativeErrors++;
            emit({
              type: "native-result",
              name: names.get(block.tool_use_id) || block.tool_use_id,
              isError: Boolean(block.is_error),
              content: JSON.parse(redact(JSON.stringify(block.content))),
            });
```

### 12. Verify files and protected fixtures

Host checks compare actual output content, the removal fixture, protected-write absence and the mock environment fixture. Evidence is collected before cleanup.

Source: `src/workspace.ts`, selected lines 54–59. Surrounding code omitted.

```typescript
fileCreated: fileContents !== null,
        fileContents,
        protectedFixtureUnchanged:
          (await contents("permission-target.txt")) === FIXTURE,
        protectedWriteCreated:
          (await contents("protected/report.txt")) !== null,
```

### 13. Render the student prediction feedback

Compare the student prediction with observed execute, block or mixed outcomes. Keep configuration reference labels separate from live event evidence.

Source: `src/client.ts`, selected lines 63–65. Surrounding code omitted.

```typescript
$("verdict").textContent =
      `Observed: ${e.observedOutcome}. Prediction: ${e.prediction || "not provided"}. ` +
      feedback;
```

## Reference topics and limits

- Allow is pre-approval: An allow list is not the available-tool inventory and does not constrain bypass mode. Unlisted calls can reach the mode or callback. Reads in the working directory may already qualify as safe built-in approvals, so a successful read alone does not prove a particular allow entry decided it.
- Bare, scoped and wildcard deny: Bare Write removal is verified separately. Scoped rules match commands or paths as written. The supplied slides and current docs describe wildcard denial as removal. In the pinned SDK MCP experiment, initialization still reports MCP names and actual calls receive permission denials. This lab verifies denied execution, not MCP definition removal. The global * form is reference syntax, not another live experiment.
- MCP literal-server patterns: Valid allow forms include mcp__classroom__* and mcp__classroom__read_*. The server segment must be literal; mcp__*__read_lesson is not a valid MCP allow pattern. The live experiment uses local classroom and archive servers, not external accounts.
- Path anchors and write coverage: The live path experiment uses Edit(./protected/**). Current SDK docs specify Edit(path) for Write and NotebookEdit too; Write(path) is not equivalent. A double slash marks an absolute path, such as Edit(//secrets/**), while one slash anchors at the rule source. These anchor examples are reference syntax, not tested filesystem targets.
- Project source and mock .env: Only project mode enables settingSources project and writes actual .claude/settings.json. Read(./.env) protects a disposable mock file. The application’s real .env is never served or placed in the agent working directory.
- Ask before a write: The supplied lesson suggests asking before git push. This application demonstrates the same ask-to-callback mechanism using a fixed local Write; no git push is performed or simulated. The callback is programmed classroom policy, not a human approval dialog.
- dontAsk has qualifications: Pair pre-approved reviewer tools with dontAsk to deny calls that would prompt. Safe built-in operations may still run. Explicitly choose tools or use bare denies when removal is required. SDK permission rules alone are not an operating-system sandbox.
- Evidence and API cost: The nine experiments use actual SDK queries with a $0.40 budget threshold per query, not a prepaid cap. Hooks, callback calls, initialization names, native feedback, MCP handlers and host file checks are observed evidence. Media, dependencies and real credentials remain excluded from Git.

## References

- [Official SDK permission rules](https://code.claude.com/docs/en/agent-sdk/permissions)
- [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)

Regenerate student pages with `python scripts/build-pages.py`. Run `npm test` for offline boundary, workspace and startup checks.
