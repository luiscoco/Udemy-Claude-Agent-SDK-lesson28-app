import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export function createClassroomServers(
  cwd: string,
  record: (name: string) => void,
) {
  return Object.fromEntries(
    ["classroom", "archive"].map((name) => [
      name,
      createSdkMcpServer({
        name,
        version: "1.0.0",
        tools: [
          tool(
            "read_lesson",
            "Read the local classroom lesson 28 fixture.",
            {},
            async () => {
              record(`mcp__${name}__read_lesson`);
              return {
                content: [
                  {
                    type: "text" as const,
                    text: await readFile(join(cwd, "lesson.txt"), "utf-8"),
                  },
                ],
              };
            },
          ),
        ],
      }),
    ]),
  );
}
