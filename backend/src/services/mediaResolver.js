const FETCHLAYER_API_ROOT = 'https://api.fetchlayer.dev/tiktok'
const FETCHLAYER_PUBLIC_DOWNLOADER_PERMITTED = false

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
  }
}

function notConfigured() {
  return failure(
    501,
    'MEDIA_RETRIEVAL_NOT_CONFIGURED',
    'Media retrieval is not configured yet.'
  )
}

function providerNotConfigured() {
  return failure(
    501,
    'PROVIDER_NOT_CONFIGURED',
    'The video provider is not configured.'
  )
}

function isVideoId(value) {
  return typeof value === 'string' && /^\d+$/.test(value)
}

function safeTitle(value) {
  return typeof value === 'string' ? value.slice(0, 160) : ''
}

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
  }
}

async function fetchLayerErrorResult(response) {
  let detail = ''

  try {
    const data = await response.json()
    if (typeof data?.error === 'string') detail = data.error
  } catch {}

  if (response.status === 403 && /download/i.test(detail)) {
    return failure(
      403,
      'DOWNLOADS_DISABLED',
      'The creator has turned off downloads for this video.'
    )
  }

  if (response.status === 404) {
    return failure(404, 'VIDEO_UNAVAILABLE', 'This video is not available for download.')
  }

  if (response.status === 402) {
    return failure(
      503,
      'PROVIDER_UNAVAILABLE',
      'The video provider has no credits available. Please try again later.'
    )
  }

  if (response.status === 401 || response.status === 403) {
    return failure(502, 'PROVIDER_ERROR', 'The video provider rejected the request.')
  }

  if (response.status === 429 || response.status === 503) {
    return failure(
      503,
      'PROVIDER_UNAVAILABLE',
      'The video provider is temporarily unavailable. Please try again shortly.'
    )
  }

  return failure(502, 'PROVIDER_ERROR', 'The video provider could not process the request.')
}

async function fetchLayerJson(env, path, body) {
  const response = await fetch(`${FETCHLAYER_API_ROOT}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.FETCHLAYER_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) return { error: await fetchLayerErrorResult(response) }

  return { data: await response.json() }
}

function streamHeaders(upstream, videoId) {
  const allowed = [
    'Content-Type',
    'Content-Length',
    'Content-Range',
    'Accept-Ranges',
    'ETag',
    'Last-Modified'
  ]

  const headers = {}
  for (const name of allowed) {
    const value = upstream.headers.get(name)
    if (value) headers[name] = value
  }

  headers['Content-Type'] = headers['Content-Type'] || 'video/mp4'
  headers['Accept-Ranges'] = headers['Accept-Ranges'] || 'bytes'
  headers['Content-Disposition'] = `attachment; filename="${videoId}.mp4"`
  headers['Cache-Control'] = 'private, no-store'
  headers['X-Content-Type-Options'] = 'nosniff'

  return headers
}

async function resolveWithFetchLayer(input, env) {
  if (!env.FETCHLAYER_API_KEY) return providerNotConfigured()

  const resolved = await fetchLayerJson(env, '/resolve-url', { url: input.url })
  if (resolved.error) return resolved.error

  if (resolved.data?.kind !== 'video' || !isVideoId(resolved.data.videoId)) {
    return failure(404, 'VIDEO_UNAVAILABLE', 'This video is not available for download.')
  }

  const videoId = resolved.data.videoId
  const detail = await fetchLayerJson(env, '/video-detail', { video: videoId })
  if (detail.error) return detail.error

  const video = detail.data?.video
  if (!video || !isVideoId(video.id)) {
    return failure(404, 'VIDEO_UNAVAILABLE', 'This video is not available for download.')
  }

  const videoAsset = Array.isArray(video.assets)
    ? video.assets.find((asset) => asset?.kind === 'video' && asset.downloadUrl)
    : null

  if (!videoAsset) {
    if (video.isPhotoPost) {
      return failure(404, 'VIDEO_UNAVAILABLE', 'This post is not a video.')
    }

    return failure(
      403,
      'DOWNLOADS_DISABLED',
      'The creator has turned off downloads for this video.'
    )
  }

  return mediaSuccess({
    id: video.id,
    title: safeTitle(video.description),
    durationSeconds: typeof video.durationSeconds === 'number' ? video.durationSeconds : null
  })
}

async function streamWithFetchLayer(input, env, request) {
  if (!isVideoId(input.videoId)) {
    return failure(400, 'INVALID_VIDEO_ID', 'A valid video id is required.')
  }

  if (!env.FETCHLAYER_API_KEY) return providerNotConfigured()

  const headers = {
    Authorization: `Bearer ${env.FETCHLAYER_API_KEY}`,
    Accept: 'video/mp4,*/*'
  }

  for (const name of ['Range', 'If-Range']) {
    const value = request?.headers?.get(name)
    if (value) headers[name] = value
  }

  const upstream = await fetch(
    `${FETCHLAYER_API_ROOT}/media?video=${encodeURIComponent(input.videoId)}`,
    { headers }
  )

  if (!upstream.ok) return fetchLayerErrorResult(upstream)

  return {
    binary: true,
    status: upstream.status,
    headers: streamHeaders(upstream, input.videoId),
    body: upstream.body
  }
}

const disabledProvider = {
  resolve: async () => notConfigured(),
  stream: async () => notConfigured()
}

const fetchLayerProvider = {
  resolve: resolveWithFetchLayer,
  stream: streamWithFetchLayer
}

const providers = {
  none: disabledProvider,
  ...(FETCHLAYER_PUBLIC_DOWNLOADER_PERMITTED ? { fetchlayer: fetchLayerProvider } : {})
}

export function createMediaResolver(providerName = 'none') {
  const provider = providers[providerName] || providers.none

  const resolve = async (input, env) => provider.resolve(input, env)
  resolve.stream = async (input, env, request) => provider.stream(input, env, request)

  return resolve
}

export const resolveMedia = createMediaResolver()
