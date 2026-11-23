var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/services/mediaResolver.js
function notConfigured() {
  return {
    status: 501,
    body: {
      ok: false,
      error: "MEDIA_RETRIEVAL_NOT_CONFIGURED",
      available: false,
      message: "Media retrieval is not configured yet."
    }
  };
}
__name(notConfigured, "notConfigured");
var providers = {
  none: /* @__PURE__ */ __name(async () => notConfigured(), "none")
};
function createMediaResolver(providerName = "none") {
  const provider = providers[providerName] || providers.none;
  return async (input) => provider(input);
}
__name(createMediaResolver, "createMediaResolver");
var resolveMedia = createMediaResolver();

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
function failure(status, error, message) {
  return { status, body: { ok: false, error, message } };
}
__name(failure, "failure");
function getBodyLimit(env) {
  const parsed = Number(env.MAX_REQUEST_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BODY_BYTES;
}
__name(getBodyLimit, "getBodyLimit");
async function handleVideoProcess(request, env) {
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return failure(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  const limit = getBodyLimit(env);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    return failure(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  let raw;
  try {
    raw = await request.text();
  } catch {
    return failure(400, "INVALID_BODY", "The request body could not be read.");
  }
  if (raw.length > limit) {
    return failure(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  }
  if (!raw.trim()) {
    return failure(400, "EMPTY_BODY", "A JSON body is required.");
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return failure(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return failure(400, "INVALID_PAYLOAD", "The request body must be a JSON object.");
  }
  const validation = validateUrl(payload.url, getAllowedHosts(env.ALLOWED_TIKTOK_HOSTS));
  if (!validation.valid) {
    return failure(validation.status, validation.error, validation.message);
  }
  const resolver = createMediaResolver(env.MEDIA_PROVIDER);
  return resolver({
    url: validation.url,
    environment: env.ENVIRONMENT || "development"
  });
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
function corsHeaders(request, env) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
__name(corsHeaders, "corsHeaders");
function failure2(status, code, message) {
  return { status, body: { ok: false, error: code, message } };
}
__name(failure2, "failure");
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
    const cors = corsHeaders(request, env);
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }
      const { pathname } = new URL(request.url);
      if (pathname === "/api/health") {
        if (request.method !== "GET") {
          return respond(
            failure2(405, "METHOD_NOT_ALLOWED", "Use GET for this endpoint."),
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
            failure2(405, "METHOD_NOT_ALLOWED", "Use POST for this endpoint."),
            { ...cors, Allow: "POST, OPTIONS" }
          );
        }
        return respond(await handleVideoProcess(request, env), cors);
      }
      return respond(failure2(404, "NOT_FOUND", "Endpoint not found."), cors);
    } catch {
      return respond(
        failure2(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred."),
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

// .wrangler/tmp/bundle-UWgDFK/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-UWgDFK/middleware-loader.entry.ts
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
