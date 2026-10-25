import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { PROJECT_RULES } from "./rules.js";
export const FIXTURE = "Protected disposable fixture · RULES-28\n";
export const MOCK_ENV = "TRAINING_TOKEN=CLASSROOM_ONLY_NOT_A_SECRET\n";
export async function prepareWorkspace(project: boolean) {
  const parent = resolve(realpathSync.native(tmpdir()), "claude-sdk28");
  const root = resolve(parent, randomUUID()),
    cwd = join(root, "project"),
    home = join(root, "home"),
    sdkHome = join(root, "sdk");
  const rel = relative(parent, root);
  if (!rel || rel.startsWith("..") || isAbsolute(rel))
    throw new Error("Invalid workspace.");
  for (const dir of [cwd, home, sdkHome, join(cwd, "protected")])
    await mkdir(dir, { recursive: true });
  await writeFile(join(cwd, "permission-target.txt"), FIXTURE, "utf-8");
  await writeFile(join(cwd, ".env"), MOCK_ENV, "utf-8");
  await writeFile(
    join(cwd, "lesson.txt"),
    JSON.stringify({
      lesson: 28,
      title: "Allow and deny rules",
      marker: "RULES-28",
      source: "local classroom fixture",
    }),
    "utf-8",
  );
  if (project) {
    await mkdir(join(cwd, ".claude"), { recursive: true });
    await writeFile(
      join(cwd, ".claude/settings.json"),
      JSON.stringify(PROJECT_RULES, null, 2),
      "utf-8",
    );
  }
  return {
    cwd,
    home,
    sdkHome,
    async inspect() {
      async function contents(file: string) {
        try {
          return await readFile(join(cwd, file), "utf-8");
        } catch {
          return null;
        }
      }
      const fileContents = await contents("result.txt");
      return {
        fileCreated: fileContents !== null,
        fileContents,
        protectedFixtureUnchanged:
          (await contents("permission-target.txt")) === FIXTURE,
        protectedWriteCreated:
          (await contents("protected/report.txt")) !== null,
        protectedEnvUnchanged: (await contents(".env")) === MOCK_ENV,
      };
    },
    async cleanup() {
      const resolved = resolve(root),
        r = relative(parent, resolved);
      if (!r || r.startsWith("..") || isAbsolute(r))
        throw new Error("Refusing cleanup outside run.");
      await rm(resolved, { recursive: true, force: true });
    },
  };
}
