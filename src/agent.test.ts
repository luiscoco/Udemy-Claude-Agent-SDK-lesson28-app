import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { SCENARIOS, validateConfig, hostAllows } from "./rules.js";
import { prepareWorkspace } from "./workspace.js";
test("fixed experiments and three prediction outcomes", () => {
  assert.throws(() => validateConfig({ mode: "custom" }));
  assert.equal(
    validateConfig({ mode: "path-deny", prediction: "mixed" }).prediction,
    "mixed",
  );
  assert.deepEqual(SCENARIOS["bare-deny"].denied, ["Write"]);
  assert.deepEqual(SCENARIOS["wildcard-deny"].denied, ["mcp__*"]);
});
test("host guard accepts only bounded fixture paths and exact shell commands", () => {
  const cwd = resolve("classroom");
  assert.equal(
    hostAllows(cwd, "path-deny", "Write", {
      file_path: resolve(cwd, "protected/report.txt"),
      content: "RULES-28\n",
    }),
    true,
  );
  assert.equal(
    hostAllows(cwd, "path-deny", "Write", {
      file_path: resolve(cwd, "../escape.txt"),
      content: "RULES-28\n",
    }),
    false,
  );
  assert.equal(
    hostAllows(cwd, "project-settings", "Read", {
      file_path: resolve(cwd, ".env"),
    }),
    true,
  );
  assert.equal(
    hostAllows(cwd, "allow-fallback", "Read", {
      file_path: resolve(cwd, ".env"),
    }),
    false,
  );
  assert.equal(
    hostAllows(cwd, "scoped-deny", "Bash", { command: "rm -rf .." }),
    false,
  );
});
test("project settings and mock env live only in a disposable workspace", async () => {
  const w = await prepareWorkspace(true);
  try {
    assert.deepEqual(await w.inspect(), {
      fileCreated: false,
      fileContents: null,
      protectedFixtureUnchanged: true,
      protectedWriteCreated: false,
      protectedEnvUnchanged: true,
    });
  } finally {
    await w.cleanup();
  }
});
