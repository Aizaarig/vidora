var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/services/mediaResolver.js
var FETCHLAYER_API_ROOT = "https://api.fetchlayer.dev/tiktok";
var FETCHLAYER_PUBLIC_DOWNLOADER_PERMITTED = false;
function failure(status, error, message, extra = {}) {
  return {
    status,
    body: {
      ok: false,
      error,
      available: false,
      ...extra,
      message
    }
  };
}
__name(failure, "failure");
function notConfigured() {
  return failure(
    501,
    "MEDIA_RETRIEVAL_NOT_CONFIGURED",
    "Media retrieval is not configured yet."
  );
}
__name(notConfigured, "notConfigured");
function providerNotConfigured() {
  return failure(
    501,
    "PROVIDER_NOT_CONFIGURED",
    "The video provider is not configured."
  );
}
__name(providerNotConfigured, "providerNotConfigured");
function isVideoId(value) {
  return typeof value === "string" && /^\d+$/.test(value);
}
__name(isVideoId, "isVideoId");
function safeTitle(value) {
  return typeof value === "string" ? value.slice(0, 160) : "";
}
__name(safeTitle, "safeTitle");
function mediaSuccess(video) {
  return {
    status: 200,
    body: {
      ok: true,
      available: true,
      video: {
        id: video.id,
        title: video.title,
        durationSeconds: video.durationSeconds
      },
      downloadUrl: `/api/video/download?videoId=${encodeURIComponent(video.id)}`,
      filename: `${video.id}.mp4`
    }
  };
}
__name(mediaSuccess, "mediaSuccess");
async function fetchLayerErrorResult(response) {
  let detail = "";
  try {
    const data = await response.json();
    if (typeof data?.error === "string") detail = data.error;
  } catch {
  }
  if (response.status === 403 && /download/i.test(detail)) {
    return failure(
      403,
      "DOWNLOADS_DISABLED",
      "The creator has turned off downloads for this video."
    );
  }
  if (response.status === 404) {
    return failure(404, "VIDEO_UNAVAILABLE", "This video is not available for download.");
  }
  if (response.status === 402) {
    return failure(
      503,
      "PROVIDER_UNAVAILABLE",
      "The video provider has no credits available. Please try again later."
    );
  }
  if (response.status === 401 || response.status === 403) {
    return failure(502, "PROVIDER_ERROR", "The video provider rejected the request.");
  }
  if (response.status === 429 || response.status === 503) {
    return failure(
      503,
      "PROVIDER_UNAVAILABLE",
      "The video provider is temporarily unavailable. Please try again shortly."
    );
  }
  return failure(502, "PROVIDER_ERROR", "The video provider could not process the request.");
}
__name(fetchLayerErrorResult, "fetchLayerErrorResult");
async function fetchLayerJson(env, path, body) {
  const response = await fetch(`${FETCHLAYER_API_ROOT}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FETCHLAYER_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) return { error: await fetchLayerErrorResult(response) };
  return { data: await response.json() };
}
__name(fetchLayerJson, "fetchLayerJson");
function streamHeaders(upstream, videoId) {
  const allowed = [
    "Content-Type",
    "Content-Length",
    "Content-Range",
    "Accept-Ranges",
    "ETag",
    "Last-Modified"
  ];
  const headers = {};
  for (const name of allowed) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  headers["Content-Type"] = headers["Content-Type"] || "video/mp4";
  headers["Accept-Ranges"] = headers["Accept-Ranges"] || "bytes";
  headers["Content-Disposition"] = `attachment; filename="${videoId}.mp4"`;
  headers["Cache-Control"] = "private, no-store";
  headers["X-Content-Type-Options"] = "nosniff";
  return headers;
}
__name(streamHeaders, "streamHeaders");
async function resolveWithFetchLayer(input, env) {
  if (!env.FETCHLAYER_API_KEY) return providerNotConfigured();
  const resolved = await fetchLayerJson(env, "/resolve-url", { url: input.url });
  if (resolved.error) return resolved.error;
  if (resolved.data?.kind !== "video" || !isVideoId(resolved.data.videoId)) {
    return failure(404, "VIDEO_UNAVAILABLE", "This video is not available for download.");
  }
  const videoId = resolved.data.videoId;
  const detail = await fetchLayerJson(env, "/video-detail", { video: videoId });
  if (detail.error) return detail.error;
  const video = detail.data?.video;
  if (!video || !isVideoId(video.id)) {
    return failure(404, "VIDEO_UNAVAILABLE", "This video is not available for download.");
  }
  const videoAsset = Array.isArray(video.assets) ? video.assets.find((asset) => asset?.kind === "video" && asset.downloadUrl) : null;
  if (!videoAsset) {
    if (video.isPhotoPost) {
      return failure(404, "VIDEO_UNAVAILABLE", "This post is not a video.");
    }
    return failure(
      403,
      "DOWNLOADS_DISABLED",
      "The creator has turned off downloads for this video."
    );
  }
  return mediaSuccess({
    id: video.id,
    title: safeTitle(video.description),
    durationSeconds: typeof video.durationSeconds === "number" ? video.durationSeconds : null
  });
}
__name(resolveWithFetchLayer, "resolveWithFetchLayer");
async function streamWithFetchLayer(input, env, request) {
  if (!isVideoId(input.videoId)) {
    return failure(400, "INVALID_VIDEO_ID", "A valid video id is required.");
  }
  if (!env.FETCHLAYER_API_KEY) return providerNotConfigured();
  const headers = {
    Authorization: `Bearer ${env.FETCHLAYER_API_KEY}`,
    Accept: "video/mp4,*/*"
  };
  for (const name of ["Range", "If-Range"]) {
    const value = request?.headers?.get(name);
    if (value) headers[name] = value;
  }
  const upstream = await fetch(
    `${FETCHLAYER_API_ROOT}/media?video=${encodeURIComponent(input.videoId)}`,
    { headers }
  );
  if (!upstream.ok) return fetchLayerErrorResult(upstream);
  return {
    binary: true,
    status: upstream.status,
    headers: streamHeaders(upstream, input.videoId),
    body: upstream.body
  };
}
__name(streamWithFetchLayer, "streamWithFetchLayer");
var disabledProvider = {
  resolve: /* @__PURE__ */ __name(async () => notConfigured(), "resolve"),
  stream: /* @__PURE__ */ __name(async () => notConfigured(), "stream")
};
var fetchLayerProvider = {
  resolve: resolveWithFetchLayer,
  stream: streamWithFetchLayer
};
var providers = {
  none: disabledProvider,
  ...FETCHLAYER_PUBLIC_DOWNLOADER_PERMITTED ? { fetchlayer: fetchLayerProvider } : {}
};
function createMediaResolver(providerName = "none") {
  const provider = providers[providerName] || providers.none;
  const resolve = /* @__PURE__ */ __name(async (input, env) => provider.resolve(input, env), "resolve");
  resolve.stream = async (input, env, request) => provider.stream(input, env, request);
  return resolve;
}
__name(createMediaResolver, "createMediaResolver");
var resolveMedia = createMediaResolver();

// src/routes/download.js
function failure2(status, error, message) {
  return { status, body: { ok: false, error, message } };
}
__name(failure2, "failure");
function createVideoDownloadResponse(result, corsHeaders2 = {}) {
  return new Response(result.body, {
    status: result.status,
    headers: {
      ...corsHeaders2,
      ...result.headers
    }
  });
}
__name(createVideoDownloadResponse, "createVideoDownloadResponse");
async function handleVideoDownload(request, env) {
  if (request.method !== "GET") {
    return {
      ...failure2(405, "METHOD_NOT_ALLOWED", "Use GET for this endpoint."),
      headers: { Allow: "GET" }
    };
  }
  const videoId = new URL(request.url).searchParams.get("videoId") || "";
  if (!/^\d+$/.test(videoId)) {
    return failure2(400, "INVALID_VIDEO_ID", "A valid video id is required.");
  }
  const resolver = createMediaResolver(env.MEDIA_PROVIDER);
  return resolver.stream({ videoId }, env, request);
}
__name(handleVideoDownload, "handleVideoDownload");

// src/utils/validateUrl.js
var DEFAULT_ALLOWED_HOSTS = [
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com"
];
var SHORT_HOSTS = /* @__PURE__ */ new Set(["vm.tiktok.com", "vt.tiktok.com"]);
function getAllowedHosts(value) {
  if (!value) return DEFAULT_ALLOWED_HOSTS;
  const hosts = String(value).split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return hosts.length ? hosts : DEFAULT_ALLOWED_HOSTS;
}
__name(getAllowedHosts, "getAllowedHosts");
function normalize(value) {
  if (value.startsWith("//")) return `https:${value}`;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;
  return `https://${value}`;
}
__name(normalize, "normalize");
function validateUrl(input, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) {
    return {
      valid: false,
      status: 400,
      error: "EMPTY_URL",
      message: "Please provide a TikTok video URL."
    };
  }
  if (/\s/.test(value)) {
    return {
      valid: false,
      status: 400,
      error: "INVALID_URL",
      message: "The URL is not formatted correctly."
    };
  }
  let url;
  try {
    url = new URL(normalize(value));
  } catch {
    return {
      valid: false,
      status: 400,
      error: "INVALID_URL",
      message: "The URL is not formatted correctly."
    };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      valid: false,
      status: 400,
      error: "UNSUPPORTED_PROTOCOL",
      message: "Only http and https URLs are supported."
    };
  }
  const hostname = url.hostname.toLowerCase();
  const allowed = allowedHosts.map((host) => host.toLowerCase());
  if (!allowed.includes(hostname)) {
    return {
      valid: false,
      status: 422,
      error: "UNSUPPORTED_WEBSITE",
      message: "Only TikTok URLs are supported."
    };
  }
  const path = url.pathname.replace(/\/+$/, "");
  const hasVideoPath = /\/video\/\d+/.test(path);
  const hasShortPath = /\/t\/[^/]+/.test(path);
  const hasShortHostPath = SHORT_HOSTS.has(hostname) && path.split("/").filter(Boolean).length > 0;
  if (!hasVideoPath && !hasShortPath && !hasShortHostPath) {
    return {
      valid: false,
      status: 422,
      error: "NOT_A_VIDEO_URL",
      message: "The URL does not point to a TikTok video."
    };
  }
  return { valid: true, url: value };
}
__name(validateUrl, "validateUrl");

// src/routes/video.js
var DEFAULT_MAX_BODY_BYTES = 8192;
function failure3(status, error, message) {
  return { status, body: { ok: false, error, message } };
}
__name(failure3, "failure");
function getBodyLimit(env) {
  const parsed = Number(env.MAX_REQUEST_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BODY_BYTES;
}
__name(getBodyLimit, "getBodyLimit");
async function handleVideoProcess(request, env) {
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return failure3(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  const limit = getBodyLimit(env);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    return failure3(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  let raw;
  try {
    raw = await request.text();
  } catch {
    return failure3(400, "INVALID_BODY", "The request body could not be read.");
  }
  if (raw.length > limit) {
    return failure3(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  if (!raw.trim()) {
    return failure3(400, "EMPTY_BODY", "A JSON body is required.");
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return failure3(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return failure3(400, "INVALID_PAYLOAD", "The request body must be a JSON object.");
  }
  const validation = validateUrl(payload.url, getAllowedHosts(env.ALLOWED_TIKTOK_HOSTS));
  if (!validation.valid) {
    return failure3(validation.status, validation.error, validation.message);
  }
  const resolver = createMediaResolver(env.MEDIA_PROVIDER);
  return resolver(
    {
      url: validation.url,
      environment: env.ENVIRONMENT || "development"
    },
    env
  );
}
__name(handleVideoProcess, "handleVideoProcess");

// src/index.js
var DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
function allowedOrigins(env) {
  if (env.ALLOWED_ORIGINS === void 0 || env.ALLOWED_ORIGINS === null) {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  if (!env.ALLOWED_ORIGINS) return [];
  return String(env.ALLOWED_ORIGINS).split(",").map((origin) => origin.trim()).filter(Boolean);
}
__name(allowedOrigins, "allowedOrigins");
function corsHeaders() {
  return {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range, If-Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type, Content-Disposition, ETag, Last-Modified",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function withAllowedOrigin(request, env, headers) {
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
__name(withAllowedOrigin, "withAllowedOrigin");
function failure4(status, code, message) {
  return { status, body: { ok: false, error: code, message } };
}
__name(failure4, "failure");
function respond(result, headers = {}) {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}
__name(respond, "respond");
var src_default = {
  async fetch(request, env) {
    const cors = withAllowedOrigin(request, env, corsHeaders());
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }
      const { pathname } = new URL(request.url);
      if (pathname === "/api/health") {
        if (request.method !== "GET") {
          return respond(
            failure4(405, "METHOD_NOT_ALLOWED", "Use GET for this endpoint."),
            { ...cors, Allow: "GET" }
          );
        }
        return respond(
          {
            status: 200,
            body: {
              ok: true,
              status: "ok",
              service: "vidora-backend",
              environment: env.ENVIRONMENT || "development",
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            }
          },
          cors
        );
      }
      if (pathname === "/api/video/process") {
        if (request.method !== "POST") {
          return respond(
            failure4(405, "METHOD_NOT_ALLOWED", "Use POST for this endpoint."),
            { ...cors, Allow: "POST, OPTIONS" }
          );
        }
        return respond(await handleVideoProcess(request, env), cors);
      }
      if (pathname === "/api/video/download") {
        const result = await handleVideoDownload(request, env);
        if (result.binary) {
          return createVideoDownloadResponse(result, cors);
        }
        return respond(result, { ...cors, ...result.headers || {} });
      }
      return respond(failure4(404, "NOT_FOUND", "Endpoint not found."), cors);
    } catch {
      return respond(
        failure4(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred."),
        cors
      );
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-HcMrWj/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-HcMrWj/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
