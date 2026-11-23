import { handleVideoDownload, createVideoDownloadResponse } from './routes/download.js'
import { handleVideoProcess } from './routes/video.js'

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]

function allowedOrigins(env) {
  if (env.ALLOWED_ORIGINS === undefined || env.ALLOWED_ORIGINS === null) {
    return DEFAULT_ALLOWED_ORIGINS
  }

  if (!env.ALLOWED_ORIGINS) return []

  return String(env.ALLOWED_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range, If-Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type, Content-Disposition, ETag, Last-Modified',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  }
}

function withAllowedOrigin(request, env, headers) {
  const origin = request.headers.get('Origin')
  if (origin && allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

function failure(status, code, message) {
  return { status, body: { ok: false, error: code, message } }
}

function respond(result, headers = {}) {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  })
}

export default {
  async fetch(request, env) {
    const cors = withAllowedOrigin(request, env, corsHeaders())

    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors })
      }

      const { pathname } = new URL(request.url)

      if (pathname === '/api/health') {
        if (request.method !== 'GET') {
          return respond(
            failure(405, 'METHOD_NOT_ALLOWED', 'Use GET for this endpoint.'),
            { ...cors, Allow: 'GET' }
          )
        }

        return respond(
          {
            status: 200,
            body: {
              ok: true,
              status: 'ok',
              service: 'vidora-backend',
              environment: env.ENVIRONMENT || 'development',
              timestamp: new Date().toISOString()
            }
          },
          cors
        )
      }

      if (pathname === '/api/video/process') {
        if (request.method !== 'POST') {
          return respond(
            failure(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.'),
            { ...cors, Allow: 'POST, OPTIONS' }
          )
        }

        return respond(await handleVideoProcess(request, env), cors)
      }

      if (pathname === '/api/video/download') {
        const result = await handleVideoDownload(request, env)

        if (result.binary) {
          return createVideoDownloadResponse(result, cors)
        }

        return respond(result, { ...cors, ...(result.headers || {}) })
      }

      return respond(failure(404, 'NOT_FOUND', 'Endpoint not found.'), cors)
    } catch {
      return respond(
        failure(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
        cors
      )
    }
  }
}
