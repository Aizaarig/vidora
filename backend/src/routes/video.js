import { createMediaResolver } from '../services/mediaResolver.js'
import { getAllowedHosts, validateUrl } from '../utils/validateUrl.js'

const DEFAULT_MAX_BODY_BYTES = 8192

function failure(status, error, message) {
  return { status, body: { ok: false, error, message } }
}

function getBodyLimit(env) {
  const parsed = Number(env.MAX_REQUEST_BYTES)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BODY_BYTES
}

export async function handleVideoProcess(request, env) {
  const contentType = (request.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase()

  if (contentType !== 'application/json') {
    return failure(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.')
  }

  const limit = getBodyLimit(env)
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    return failure(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.')
  }

  let raw
  try {
    raw = await request.text()
  } catch {
    return failure(400, 'INVALID_BODY', 'The request body could not be read.')
  }

  if (raw.length > limit) {
    return failure(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.')
  }

  if (!raw.trim()) {
    return failure(400, 'EMPTY_BODY', 'A JSON body is required.')
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return failure(400, 'INVALID_JSON', 'The request body must be valid JSON.')
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return failure(400, 'INVALID_PAYLOAD', 'The request body must be a JSON object.')
  }

  const validation = validateUrl(payload.url, getAllowedHosts(env.ALLOWED_TIKTOK_HOSTS))
  if (!validation.valid) {
    return failure(validation.status, validation.error, validation.message)
  }

  const resolver = createMediaResolver(env.MEDIA_PROVIDER)

  return resolver(
    {
      url: validation.url,
      environment: env.ENVIRONMENT || 'development'
    },
    env
  )
}
