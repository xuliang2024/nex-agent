import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import type {
  AppStore,
  AgentTemplate,
  MCPServerConfig,
  SkillConfig,
  SessionConfig,
} from "./store.js";

export interface TemplateManifest {
  formatVersion: 1;
  id: string;
  name: string;
  description: string;
  icon: string;
  config: {
    instructions: string;
    model: string;
    provider: string;
    providerBaseURL?: string;
    maxSteps: number;
    requireApproval: "all" | "dangerous" | "none";
    tools: { workspace: boolean; sandbox: boolean };
    sandboxIsolation: "none" | "seatbelt" | "bwrap";
  };
  mcpServers: { file: string; id: string; name: string }[];
  skills: {
    dir: string;
    id: string;
    name: string;
    source?: string;
    slug?: string;
    sourceUrl?: string;
  }[];
  requiredKeys: string[];
  createdAt: string;
}

function sanitizeMCP(mcp: MCPServerConfig): MCPServerConfig {
  const copy = { ...mcp };
  if (copy.env) {
    copy.env = Object.fromEntries(Object.keys(copy.env).map((k) => [k, ""]));
  }
  if (copy.headers) {
    copy.headers = Object.fromEntries(
      Object.keys(copy.headers).map((k) => [k, ""]),
    );
  }
  return copy;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

export function exportTemplate(
  template: AgentTemplate,
  store: AppStore,
  destPath: string,
): void {
  const zip = new AdmZip();
  const cfg = template.config;

  const mcpEntries: TemplateManifest["mcpServers"] = [];
  for (const mcp of cfg.mcp) {
    if (mcp.isSystem) continue;
    const fileName = `mcp/${safeName(mcp.name || mcp.id)}.json`;
    const sanitized = sanitizeMCP(mcp);
    zip.addFile(fileName, Buffer.from(JSON.stringify(sanitized, null, 2)));
    mcpEntries.push({ file: fileName, id: mcp.id, name: mcp.name });
  }

  const skillLib = store.listSkillLibrary();
  const skillMap = new Map<string, SkillConfig>();
  for (const s of skillLib) skillMap.set(s.path, s);

  const skillEntries: TemplateManifest["skills"] = [];
  for (const skillPath of cfg.skills) {
    const meta = skillMap.get(skillPath);
    if (meta?.isSystem) continue;
    if (!fs.existsSync(skillPath)) continue;
    const name = meta?.name || path.basename(path.dirname(skillPath));
    const dirName = `skills/${safeName(name)}`;
    const content = fs.readFileSync(skillPath, "utf-8");
    zip.addFile(`${dirName}/SKILL.md`, Buffer.from(content));
    skillEntries.push({
      dir: dirName,
      id: meta?.id || "",
      name,
      source: meta?.source,
      slug: meta?.slug,
      sourceUrl: meta?.sourceUrl,
    });
  }

  const manifest: TemplateManifest = {
    formatVersion: 1,
    id: template.id,
    name: template.name,
    description: template.description,
    icon: template.icon,
    config: {
      instructions: cfg.instructions,
      model: cfg.model,
      provider: cfg.provider,
      providerBaseURL: cfg.providerBaseURL,
      maxSteps: cfg.maxSteps,
      requireApproval: cfg.requireApproval,
      tools: { workspace: cfg.tools.workspace, sandbox: cfg.tools.sandbox },
      sandboxIsolation: cfg.sandboxIsolation,
    },
    mcpServers: mcpEntries,
    skills: skillEntries,
    requiredKeys: [cfg.provider],
    createdAt: template.createdAt,
  };

  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));
  zip.writeZip(destPath);
}

export function importTemplate(
  naxPath: string,
  store: AppStore,
): AgentTemplate {
  const zip = new AdmZip(naxPath);
  const manifestEntry = zip.getEntry("manifest.json");
  if (!manifestEntry) throw new Error("Invalid .nax file: missing manifest.json");

  const manifest: TemplateManifest = JSON.parse(
    manifestEntry.getData().toString("utf-8"),
  );
  if (manifest.formatVersion !== 1) {
    throw new Error(`Unsupported format version: ${manifest.formatVersion}`);
  }

  const mcpIds: string[] = [];
  for (const mcpEntry of manifest.mcpServers) {
    const entry = zip.getEntry(mcpEntry.file);
    if (!entry) continue;
    const mcpConfig: MCPServerConfig = JSON.parse(
      entry.getData().toString("utf-8"),
    );
    const existingMcp = store.getMCPFromLibrary(mcpEntry.id);
    if (existingMcp) {
      if (mcpConfig.env) {
        for (const [k, v] of Object.entries(mcpConfig.env)) {
          if (!v && existingMcp.env?.[k]) mcpConfig.env[k] = existingMcp.env[k];
        }
      }
      if (mcpConfig.headers) {
        for (const [k, v] of Object.entries(mcpConfig.headers)) {
          if (!v && existingMcp.headers?.[k]) mcpConfig.headers[k] = existingMcp.headers[k];
        }
      }
      store.updateMCPInLibrary(mcpEntry.id, mcpConfig);
    } else {
      const lib = store as any;
      lib.data.mcpLibrary[mcpConfig.id] = mcpConfig;
    }
    mcpIds.push(mcpConfig.id);
  }

  const skillsDir = store.getSkillsDir();
  const skillIds: string[] = [];
  for (const skillEntry of manifest.skills) {
    const mdEntry = zip.getEntry(`${skillEntry.dir}/SKILL.md`);
    if (!mdEntry) continue;
    const content = mdEntry.getData().toString("utf-8");
    const destDir = path.join(skillsDir, "imported", safeName(skillEntry.name));
    fs.mkdirSync(destDir, { recursive: true });
    const destFile = path.join(destDir, "SKILL.md");
    fs.writeFileSync(destFile, content);

    const existingSkill = skillEntry.id ? store.getSkillFromLibrary(skillEntry.id) : null;
    if (existingSkill) {
      store.updateSkillInLibrary(skillEntry.id, {
        path: destFile,
        name: skillEntry.name,
        source: (skillEntry.source as SkillConfig["source"]) || "local",
        slug: skillEntry.slug,
        sourceUrl: skillEntry.sourceUrl,
      });
      skillIds.push(skillEntry.id);
    } else {
      const added = store.addSkillToLibrary({
        name: skillEntry.name,
        path: destFile,
        source: (skillEntry.source as SkillConfig["source"]) || "local",
        slug: skillEntry.slug,
        sourceUrl: skillEntry.sourceUrl,
      });
      skillIds.push(added.id);
    }
  }

  const systemMcpIds = store
    .listMCPLibrary()
    .filter((m) => m.isSystem)
    .map((m) => m.id);
  const systemSkillIds = store.getSystemSkillIds();

  const settings = store.getSettings();
  const config: SessionConfig = {
    ...manifest.config,
    mcp: [],
    mcpRefs: [...new Set([...systemMcpIds, ...mcpIds])],
    skills: [],
    skillRefs: [...new Set([...systemSkillIds, ...skillIds])],
    workspacePath: settings.defaults.workspacePath,
  };
  config.mcp = store.resolveSessionMCP(config.mcpRefs);
  config.skills = store.resolveSessionSkills(config.skillRefs);

  const template = store.createTemplate({
    name: manifest.name,
    description: manifest.description,
    icon: manifest.icon,
    config,
  });

  return template;
}
