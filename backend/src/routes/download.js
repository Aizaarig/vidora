import { createMediaResolver } from '../services/mediaResolver.js'

function failure(status, error, message) {
  return { status, body: { ok: false, error, message } }
}

export function createVideoDownloadResponse(result, corsHeaders = {}) {
  return new Response(result.body, {
    status: result.status,
    headers: {
      ...corsHeaders,
      ...result.headers
    }
  })
}

export async function handleVideoDownload(request, env) {
  if (request.method !== 'GET') {
    return {
      ...failure(405, 'METHOD_NOT_ALLOWED', 'Use GET for this endpoint.'),
      headers: { Allow: 'GET' }
    }
  }

  const videoId = new URL(request.url).searchParams.get('videoId') || ''
  if (!/^\d+$/.test(videoId)) {
    return failure(400, 'INVALID_VIDEO_ID', 'A valid video id is required.')
  }

  const resolver = createMediaResolver(env.MEDIA_PROVIDER)
  return resolver.stream({ videoId }, env, request)
}
