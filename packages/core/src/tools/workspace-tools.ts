import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { getApizClient } from "../services/apiz-client.js";

function safePath(workspacePath: string, relPath: string): string {
  const resolved = path.resolve(workspacePath, relPath);
  if (!resolved.startsWith(path.resolve(workspacePath))) {
    throw new Error(
      `Path "${relPath}" escapes workspace root "${workspacePath}"`,
    );
  }
  return resolved;
}

export function buildWorkspaceTools(workspacePath: string) {
  const readFile = createTool({
    id: "readFile",
    description:
      "Read the contents of a file. The path is relative to the workspace root.",
    inputSchema: z.object({
      path: z.string().describe("File path relative to workspace root"),
      encoding: z
        .enum(["utf-8", "base64"])
        .default("utf-8")
        .describe("File encoding"),
    }),
    outputSchema: z.object({
      content: z.string(),
      size: z.number(),
    }),
    execute: async (input) => {
      const abs = safePath(workspacePath, input.path);
      const content = fs.readFileSync(abs, input.encoding as BufferEncoding);
      const stat = fs.statSync(abs);
      return { content, size: stat.size };
    },
  });

  const writeFile = createTool({
    id: "writeFile",
    description:
      "Write content to a file. Creates parent directories if needed. The path is relative to the workspace root.",
    inputSchema: z.object({
      path: z.string().describe("File path relative to workspace root"),
      content: z.string().describe("Content to write"),
    }),
    outputSchema: z.object({
      bytesWritten: z.number(),
      absolutePath: z.string(),
    }),
    execute: async (input) => {
      const abs = safePath(workspacePath, input.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, input.content, "utf-8");
      return {
        bytesWritten: Buffer.byteLength(input.content),
        absolutePath: abs,
      };
    },
  });

  const listDir = createTool({
    id: "listDir",
    description:
      "List files and directories. The path is relative to the workspace root.",
    inputSchema: z.object({
      path: z
        .string()
        .default(".")
        .describe("Directory path relative to workspace root"),
      recursive: z
        .boolean()
        .default(false)
        .describe("List recursively (max 3 levels)"),
    }),
    outputSchema: z.object({
      entries: z.array(
        z.object({
          name: z.string(),
          type: z.enum(["file", "directory"]),
          size: z.number().optional(),
        }),
      ),
    }),
    execute: async (input) => {
      const abs = safePath(workspacePath, input.path ?? ".");

      function readDir(
        dir: string,
        depth: number,
      ): Array<{ name: string; type: "file" | "directory"; size?: number }> {
        const results: Array<{
          name: string;
          type: "file" | "directory";
          size?: number;
        }> = [];
        let items: fs.Dirent[];
        try {
          items = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return results;
        }
        for (const item of items) {
          if (item.name.startsWith(".") || item.name === "node_modules")
            continue;
          const rel = path.relative(abs, path.join(dir, item.name));
          if (item.isDirectory()) {
            results.push({ name: rel, type: "directory" });
            if (input.recursive && depth < 3) {
              results.push(...readDir(path.join(dir, item.name), depth + 1));
            }
          } else {
            const stat = fs.statSync(path.join(dir, item.name));
            results.push({ name: rel, type: "file", size: stat.size });
          }
        }
        return results;
      }

      return { entries: readDir(abs, 0) };
    },
  });

  const uploadFile = createTool({
    id: "uploadFile",
    description:
      "Upload a local file to CDN and get its public URL. Supports images (png/jpg/webp/gif) and videos (mp4/webm/mov). Accepts relative paths (resolved from workspace) or absolute paths.",
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          "File path — relative to workspace root, or absolute path",
        ),
    }),
    outputSchema: z.object({
      publicUrl: z.string(),
      objectKey: z.string(),
    }),
    execute: async (input) => {
      const abs = path.isAbsolute(input.path)
        ? input.path
        : safePath(workspacePath, input.path);
      if (!fs.existsSync(abs)) {
        throw new Error(`File not found: ${input.path}`);
      }

      const fileName = path.basename(abs);
      const ext = path.extname(fileName).toLowerCase().slice(1);
      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        gif: "image/gif",
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
      };
      const contentType = mimeMap[ext] || "application/octet-stream";

      const apizClient = getApizClient("");
      const presign = await apizClient.presignUpload({
        fileName,
        contentType,
        expiresIn: 3600,
      });

      const fileBuffer = fs.readFileSync(abs);
      const uploadRes = await fetch(presign.upload_url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: fileBuffer,
      });
      if (!uploadRes.ok) {
        throw new Error(
          `Upload failed: HTTP ${uploadRes.status} ${uploadRes.statusText}`,
        );
      }

      return {
        publicUrl: presign.public_url,
        objectKey: presign.object_key,
      };
    },
  });

  return { readFile, writeFile, listDir, uploadFile };
}

export function buildSandboxTools(workspacePath: string) {
  const runCommand = createTool({
    id: "runCommand",
    description:
      "Execute a shell command in the workspace. Use for build, test, git, or other CLI tasks.",
    inputSchema: z.object({
      command: z.string().describe("Shell command to execute"),
      cwd: z
        .string()
        .optional()
        .describe("Working directory relative to workspace root"),
      timeout: z
        .number()
        .default(30000)
        .describe("Timeout in milliseconds (default 30s)"),
    }),
    outputSchema: z.object({
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number(),
    }),
    execute: async (input) => {
      const execCwd = input.cwd
        ? safePath(workspacePath, input.cwd)
        : workspacePath;
      try {
        const stdout = execSync(input.command, {
          cwd: execCwd,
          timeout: input.timeout || 30000,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return { stdout: stdout || "", stderr: "", exitCode: 0 };
      } catch (err: any) {
        return {
          stdout: err.stdout || "",
          stderr: err.stderr || err.message || "",
          exitCode: err.status ?? 1,
        };
      }
    },
  });

  return { runCommand };
}
