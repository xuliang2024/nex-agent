import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getApizClient, type ApizClient } from "../services/apiz-client.js";

const SYSTEM_TOOL_NAMES = [
  "generate",
  "get_result",
  "search_models",
  "guide",
  "account",
  "speak",
  "parse_video",
  "transfer_url",
] as const;

export const APIZ_SYSTEM_TOOL_NAMES: readonly string[] = SYSTEM_TOOL_NAMES;

const generateInput = z
  .object({
    model: z
      .string()
      .describe("Model id, e.g. fal-ai/flux-2/flash, wan/v2.6/image-to-video"),
    prompt: z
      .string()
      .optional()
      .describe("Prompt text. Use English for best results."),
    image_url: z
      .string()
      .optional()
      .describe("Public reference image URL for i2i / i2v models."),
    image_size: z
      .string()
      .optional()
      .describe("Image size for image models (e.g. square_hd, landscape_16_9)."),
    aspect_ratio: z
      .string()
      .optional()
      .describe("Aspect ratio for video models (e.g. 16:9, 9:16)."),
    duration: z
      .union([z.string(), z.number()])
      .optional()
      .describe("Video duration in seconds."),
    options: z
      .record(z.unknown())
      .optional()
      .describe("Extra model-specific parameters merged into the request."),
    parameters: z
      .record(z.unknown())
      .optional()
      .describe(
        "Legacy alias for `options` (sutui-style). If present, merged into the request the same way as `options`.",
      ),
  })
  .passthrough();

const getResultInput = z.object({
  task_id: z
    .string()
    .optional()
    .describe(
      "Task id to query. If omitted, returns the most recent task list (filterable by status/limit).",
    ),
  status: z
    .string()
    .optional()
    .describe("Filter recent tasks when task_id is omitted."),
  limit: z
    .number()
    .optional()
    .describe("Number of recent tasks to return when task_id is omitted (default 20)."),
});

const searchModelsInput = z.object({
  query: z.string().optional().describe("Free-text search across id/name/tags."),
  category: z
    .enum(["image", "video", "audio", "all"])
    .optional()
    .describe("Filter by media category."),
  capability: z
    .enum(["t2i", "i2i", "t2v", "i2v", "v2v", "t2a", "stt", "i2t", "v2t"])
    .optional()
    .describe("Filter by capability tag."),
  model_id: z
    .string()
    .optional()
    .describe("If set, returns the full detail (params schema) for that model id."),
  task_type: z.string().optional(),
  lang: z.string().optional().describe("Detail language (zh / en / ja)."),
});

const guideInput = z.object({
  skill_id: z
    .string()
    .optional()
    .describe("Skill id to fetch (e.g. sora-2, flux2-flash)."),
  query: z.string().optional().describe("Free-text search for skills."),
  category: z.string().optional().describe("Skill category filter."),
});

const accountInput = z.object({
  action: z
    .enum(["balance", "checkin", "packages", "pay"])
    .describe("Account operation to perform."),
  package_id: z
    .number()
    .optional()
    .describe("Package id, required when action=pay."),
});

const speakInput = z.object({
  action: z
    .enum(["synthesize", "list_voices", "design_voice", "clone_voice"])
    .describe("Voice operation to perform."),
  text: z.string().optional().describe("Text to synthesize (action=synthesize)."),
  voice_id: z.string().optional().describe("Voice id (action=synthesize)."),
  model: z
    .enum(["speech-2.8-hd", "speech-2.8-turbo", "speech-2.6-hd", "speech-2.6-turbo"])
    .optional()
    .describe("TTS model variant. Defaults to speech-2.8-hd."),
  speed: z
    .number()
    .min(0.5)
    .max(2)
    .optional()
    .describe("Speech rate 0.5–2.0 (action=synthesize)."),
  prompt: z.string().optional().describe("Voice description (action=design_voice)."),
  voice_name: z.string().optional(),
  audio_url: z.string().url().optional().describe("Reference audio URL (action=clone_voice)."),
  status: z
    .enum(["active", "expired", "all"])
    .optional()
    .describe("Voice list filter (action=list_voices)."),
});

const parseVideoInput = z.object({
  url: z
    .string()
    .describe(
      "Share link or text containing a video URL (Douyin, Kuaishou, Xiaohongshu, Bilibili, Weibo, TikTok, Instagram, YouTube...).",
    ),
});

const transferUrlInput = z.object({
  url: z.string().url().describe("External URL to mirror onto apiz CDN."),
  type: z.enum(["image", "audio"]).optional().describe("Asset type, default image."),
});

function ensureClient(apiKey: string | undefined): ApizClient {
  if (!apiKey) {
    throw new Error(
      "NEXAI_API_KEY is missing. Sign in to NEX AI in the app to enable system tools.",
    );
  }
  return getApizClient(apiKey);
}

export interface BuildApizToolsOptions {
  apiKey: string;
}

export function buildApizTools({ apiKey }: BuildApizToolsOptions) {
  const generate = createTool({
    id: "generate",
    description:
      "Submit an AI generation task (image/video/audio) on apiz.ai. Returns a task_id immediately; poll get_result until status is completed. 80% of calls only need {model, prompt}. Extra model-specific fields can be passed at the top level or inside `options`.",
    inputSchema: generateInput,
    execute: async (input: any) => {
      const client = ensureClient(apiKey);
      const { model, options, parameters, ...rest } = input as {
        model: string;
        options?: Record<string, unknown>;
        parameters?: Record<string, unknown>;
        [key: string]: unknown;
      };
      const params: Record<string, unknown> = { ...rest };
      if (options && typeof options === "object") Object.assign(params, options);
      if (parameters && typeof parameters === "object") Object.assign(params, parameters);
      return client.tasks.create({ model, params });
    },
  });

  const getResult = createTool({
    id: "get_result",
    description:
      "Query an apiz.ai generation task by task_id. Without task_id, returns the most recent task list (filterable by status/limit).",
    inputSchema: getResultInput,
    execute: async (input) => {
      const client = ensureClient(apiKey);
      if (input.task_id) {
        return client.tasks.query(input.task_id);
      }
      return client.listRecentTasks({
        status: input.status,
        limit: input.limit,
      });
    },
  });

  const searchModels = createTool({
    id: "search_models",
    description:
      "Discover apiz.ai models by free-text query / category / capability. Pass model_id to get the full parameter schema for that model.",
    inputSchema: searchModelsInput,
    execute: async (input) => {
      const client = ensureClient(apiKey);
      if (input.model_id) {
        return client.models.get(input.model_id, { lang: input.lang });
      }
      return client.models.search({
        query: input.query,
        category: input.category,
        capability: input.capability,
        task_type: input.task_type,
      });
    },
  });

  const guide = createTool({
    id: "guide",
    description:
      "Fetch a skill tutorial (skill_id) or list/search skills. Common skill_id: sora-2, flux2-flash, seedream-image, wan-video, minimax-audio, nano-banana-pro.",
    inputSchema: guideInput,
    execute: async (input) => {
      const client = ensureClient(apiKey);
      if (input.skill_id) {
        return client.skills.get(input.skill_id);
      }
      const list = await client.skills.list({ category: input.category });
      if (!input.query) return list;
      const q = input.query.toLowerCase();
      return list.filter((s) =>
        `${s.id} ${s.name} ${s.description ?? ""}`.toLowerCase().includes(q),
      );
    },
  });

  const account = createTool({
    id: "account",
    description:
      "Account utilities: action=balance (check credits), checkin (daily reward), packages (top-up plans), pay (generate payment link, requires package_id).",
    inputSchema: accountInput,
    execute: async (input) => {
      const client = ensureClient(apiKey);
      switch (input.action) {
        case "balance":
          return client.account.balance();
        case "checkin":
          return client.account.checkin();
        case "packages":
          return client.account.packages();
        case "pay": {
          if (input.package_id === undefined) {
            throw new Error("account(pay) requires package_id");
          }
          return client.account.pay(input.package_id);
        }
      }
    },
  });

  const speak = createTool({
    id: "speak",
    description:
      "Voice utilities backed by Minimax: action=synthesize (TTS, needs text+voice_id), list_voices, design_voice (natural-language voice design, needs prompt), clone_voice (needs audio_url).",
    inputSchema: speakInput,
    execute: async (input) => {
      const client = ensureClient(apiKey);
      switch (input.action) {
        case "synthesize": {
          if (!input.text || !input.voice_id) {
            throw new Error("speak(synthesize) requires text and voice_id");
          }
          return client.voices.synthesize({
            text: input.text,
            voice_id: input.voice_id,
            model: input.model,
            speed: input.speed,
          });
        }
        case "list_voices":
          return client.voices.list({ status: input.status });
        case "design_voice": {
          if (!input.prompt) {
            throw new Error("speak(design_voice) requires prompt");
          }
          return client.voices.design({
            prompt: input.prompt,
            voice_name: input.voice_name,
          });
        }
        case "clone_voice": {
          if (!input.audio_url) {
            throw new Error("speak(clone_voice) requires audio_url");
          }
          return client.voices.clone({
            audio_url: input.audio_url,
            voice_name: input.voice_name,
          });
        }
      }
    },
  });

  const parseVideo = createTool({
    id: "parse_video",
    description:
      "Free tool: extract a no-watermark video URL from a share link or text (Douyin/Kuaishou/Xiaohongshu/Bilibili/Weibo/TikTok/Instagram/YouTube).",
    inputSchema: parseVideoInput,
    execute: async (input) => {
      const client = ensureClient(apiKey);
      return client.tools.parseVideo(input.url);
    },
  });

  const transferUrl = createTool({
    id: "transfer_url",
    description: "Free tool: mirror an external image/audio URL onto apiz CDN.",
    inputSchema: transferUrlInput,
    execute: async (input) => {
      const client = ensureClient(apiKey);
      return client.tools.transferUrl(input.url, input.type ?? "image");
    },
  });

  return {
    generate,
    get_result: getResult,
    search_models: searchModels,
    guide,
    account,
    speak,
    parse_video: parseVideo,
    transfer_url: transferUrl,
  };
}
