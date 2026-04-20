import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SkillConfig } from "./store.js";

export interface AgentSkillSearchResult {
  slug: string;
  name: string;
  owner: string;
  description: string;
  installCount: number;
  githubStars: number;
  securityScore: number;
  contentQualityScore: number;
  contentSha: string;
  updatedAt: string;
}

export interface AgentSkillSearchResponse {
  results: AgentSkillSearchResult[];
  total: number;
  hasMore: boolean;
}

export interface AgentSkillInstallResponse {
  slug: string;
  name: string;
  owner: string;
  description: string;
  skillMd: string;
  contentSha: string;
  securityScore: number;
  contentQualityScore: number;
  installCount: number;
  githubStars: number;
}

function parseYamlFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, any> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith("[") && val.endsWith("]")) {
        val = val.slice(1, -1);
        result[key] = val.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      } else {
        result[key] = val.replace(/^['"]|['"]$/g, "");
      }
    }
  }
  return result;
}

function contentHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 8);
}

export async function searchAgentSkill(
  query: string,
  limit = 10,
): Promise<AgentSkillSearchResponse> {
  const url = `https://agentskill.sh/api/agent/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export async function importFromAgentSkill(
  slug: string,
  skillsDir: string,
): Promise<{ config: Omit<SkillConfig, "id" | "createdAt">; filePath: string }> {
  const encodedSlug = encodeURIComponent(slug);
  const url = `https://agentskill.sh/api/agent/skills/${encodedSlug}/install?platform=cursor`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Install failed: ${res.status}`);
  const data: AgentSkillInstallResponse = await res.json();

  const [owner, name] = slug.includes("/") ? slug.split("/", 2) : ["unknown", slug];
  const destDir = path.join(skillsDir, "agentskill", owner, name);
  fs.mkdirSync(destDir, { recursive: true });
  const filePath = path.join(destDir, "SKILL.md");
  fs.writeFileSync(filePath, data.skillMd);

  fetch(`https://agentskill.sh/api/skills/${encodedSlug}/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "nex-agent", agentTarget: "cursor" }),
  }).catch(() => {});

  return {
    filePath,
    config: {
      name: data.name || name,
      description: data.description,
      path: filePath,
      source: "agentskill",
      sourceUrl: `https://agentskill.sh/${slug}`,
      slug,
      contentSha: data.contentSha,
      securityScore: data.securityScore,
      qualityScore: data.contentQualityScore,
    },
  };
}

export async function importFromGitHub(
  input: string,
  skillsDir: string,
): Promise<{ config: Omit<SkillConfig, "id" | "createdAt">; filePath: string }> {
  let ownerRepo = input
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\/$/, "")
    .replace(/\.git$/, "");
  const parts = ownerRepo.split("/");
  if (parts.length < 2) throw new Error("Invalid GitHub URL. Use owner/repo format.");
  const owner = parts[0];
  const repo = parts[1];

  let content: string | null = null;
  for (const branch of ["main", "master"]) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/SKILL.md`;
    const res = await fetch(url);
    if (res.ok) {
      content = await res.text();
      break;
    }
  }
  if (!content) throw new Error(`No SKILL.md found in ${owner}/${repo}`);

  const destDir = path.join(skillsDir, "github", owner, repo);
  fs.mkdirSync(destDir, { recursive: true });
  const filePath = path.join(destDir, "SKILL.md");
  fs.writeFileSync(filePath, content);

  const meta = parseYamlFrontmatter(content);
  return {
    filePath,
    config: {
      name: meta.name || repo,
      description: meta.description,
      path: filePath,
      tags: Array.isArray(meta.tags) ? meta.tags : undefined,
      source: "github",
      sourceUrl: `https://github.com/${owner}/${repo}`,
      slug: `${owner}/${repo}`,
      contentSha: contentHash(content),
    },
  };
}

export async function checkSkillUpdate(
  skill: SkillConfig,
): Promise<{ hasUpdate: boolean; newSha?: string }> {
  if (skill.source === "agentskill" && skill.slug) {
    const encodedSlug = encodeURIComponent(skill.slug);
    const res = await fetch(
      `https://agentskill.sh/api/agent/skills/${encodedSlug}/version`,
    );
    if (!res.ok) return { hasUpdate: false };
    const data = await res.json();
    const newSha = data.contentSha || data.sha;
    if (newSha && newSha !== skill.contentSha) {
      return { hasUpdate: true, newSha };
    }
  } else if (skill.source === "github" && skill.slug) {
    const [owner, repo] = skill.slug.split("/", 2);
    for (const branch of ["main", "master"]) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/SKILL.md`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        const newSha = contentHash(text);
        if (newSha !== skill.contentSha) {
          return { hasUpdate: true, newSha };
        }
        break;
      }
    }
  }
  return { hasUpdate: false };
}

export async function updateSkill(
  skill: SkillConfig,
  skillsDir: string,
): Promise<Partial<SkillConfig> | null> {
  if (skill.source === "agentskill" && skill.slug) {
    const { config } = await importFromAgentSkill(skill.slug, skillsDir);
    return {
      contentSha: config.contentSha,
      securityScore: config.securityScore,
      qualityScore: config.qualityScore,
      description: config.description,
    };
  } else if (skill.source === "github" && skill.slug) {
    const { config } = await importFromGitHub(skill.slug, skillsDir);
    return {
      contentSha: config.contentSha,
      description: config.description,
      tags: config.tags,
    };
  }
  return null;
}
