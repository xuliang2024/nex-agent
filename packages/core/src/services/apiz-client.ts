import { Apiz, type ApizOptions } from "apiz-sdk";

const DEFAULT_BASE_URL = "https://api.apiz.ai";
const DEFAULT_TIMEOUT_MS = 60_000;

export interface PresignUploadParams {
  fileName: string;
  contentType: string;
  expiresIn?: number;
}

export interface PresignUploadResult {
  upload_url: string;
  public_url: string;
  object_key: string;
}

export interface ListAPIKeysParams {
  token: string;
  user_type?: number;
  page?: number;
  page_size?: number;
}

export interface AdminModelsListResult {
  models?: unknown[];
  [key: string]: unknown;
}

export interface RecentTasksParams {
  status?: "pending" | "processing" | "completed" | "failed" | string;
  limit?: number;
}

/**
 * Thin extension of Apiz that exposes a few endpoints the official SDK does
 * not yet wrap (presigned upload, raw apikeys list, admin model list, recent
 * task list). Uses the protected `_http` HttpClient so retries / timeouts /
 * typed errors stay consistent with the rest of the SDK.
 */
export class ApizClient extends Apiz {
  constructor(options: ApizOptions = {}) {
    super({
      baseURL: DEFAULT_BASE_URL,
      timeout: DEFAULT_TIMEOUT_MS,
      ...options,
    });
  }

  private get http(): {
    request: <T>(opts: {
      method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
      path: string;
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined | null>;
      headers?: Record<string, string>;
      auth?: boolean;
      signal?: AbortSignal;
    }) => Promise<T>;
  } {
    return (this as unknown as { _http: any })._http;
  }

  async presignUpload(params: PresignUploadParams): Promise<PresignUploadResult> {
    return this.http.request<PresignUploadResult>({
      method: "POST",
      path: "/api/tos/get-presigned-url",
      auth: false,
      body: {
        file_name: params.fileName,
        content_type: params.contentType,
        expires_in: params.expiresIn ?? 3600,
      },
    });
  }

  async listAPIKeys(params: ListAPIKeysParams): Promise<unknown> {
    return this.http.request({
      method: "POST",
      path: "/api/v3/apikeys/list",
      auth: false,
      body: {
        token: params.token,
        user_type: params.user_type ?? 1,
        page: params.page ?? 1,
        page_size: params.page_size ?? 10,
      },
    });
  }

  async listAdminModels(): Promise<AdminModelsListResult | unknown[]> {
    return this.http.request<AdminModelsListResult | unknown[]>({
      method: "GET",
      path: "/v3/models",
    });
  }

  async listRecentTasks(params: RecentTasksParams = {}): Promise<unknown> {
    return this.http.request({
      method: "POST",
      path: "/api/v3/tasks/list",
      body: {
        status: params.status,
        limit: params.limit ?? 20,
      },
    });
  }
}

let cached: { key: string; client: ApizClient } | null = null;

export function getApizClient(apiKey: string, options: Partial<ApizOptions> = {}): ApizClient {
  const k = apiKey || "";
  if (cached && cached.key === k) return cached.client;
  const client = new ApizClient({ apiKey: k, ...options });
  cached = { key: k, client };
  return client;
}

export function resetApizClient(): void {
  cached = null;
}
