import assert from 'node:assert/strict'
import test from 'node:test'

import worker from '../src/index.js'
import { createVideoDownloadResponse } from '../src/routes/download.js'
import { createMediaResolver, resolveMedia } from '../src/services/mediaResolver.js'

const env = {
  ENVIRONMENT: 'development',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  ALLOWED_TIKTOK_HOSTS: 'tiktok.com,www.tiktok.com,m.tiktok.com,vm.tiktok.com,vt.tiktok.com',
  MAX_REQUEST_BYTES: '8192',
  MEDIA_PROVIDER: 'none'
}

function request(path, init = {}, overrides = {}) {
  return worker.fetch(new Request(`http://localhost${path}`, init), { ...env, ...overrides })
}

function postProcess(body, headers = {}, overrides = {}) {
  return request(
    '/api/video/process',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body
    },
    overrides
  )
}

function jsonBody(value) {
  return JSON.stringify({ url: value })
}

test('health endpoint returns backend status', async () => {
  const response = await request('/api/health')
  assert.equal(response.status, 200)

  const data = await response.json()
  assert.equal(data.ok, true)
  assert.equal(data.status, 'ok')
  assert.equal(data.service, 'vidora-backend')
  assert.equal(data.environment, 'development')
})

test('health endpoint rejects non-GET methods', async () => {
  const response = await request('/api/health', { method: 'POST' })
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('Allow'), 'GET')
})

test('valid standard and shortened TikTok URLs reach the disabled resolver', async () => {
  const urls = [
    'https://www.tiktok.com/@user/video/123456789',
    'https://vm.tiktok.com/ZSabc123/',
    'https://www.tiktok.com/t/ZTRabc123/'
  ]

  for (const url of urls) {
    const response = await postProcess(jsonBody(url))
    assert.equal(response.status, 501)

    const data = await response.json()
    assert.equal(data.ok, false)
    assert.equal(data.error, 'MEDIA_RETRIEVAL_NOT_CONFIGURED')
    assert.equal(data.available, false)
    assert.equal(data.downloadUrl, undefined)
  }
})

test('empty URL is rejected', async () => {
  const response = await postProcess(jsonBody(''))
  assert.equal(response.status, 400)

  const data = await response.json()
  assert.equal(data.error, 'EMPTY_URL')
})

test('malformed URL is rejected', async () => {
  const response = await postProcess(jsonBody('not a url'))
  assert.equal(response.status, 400)

  const data = await response.json()
  assert.equal(data.error, 'INVALID_URL')
})

test('unsupported website is rejected', async () => {
  const response = await postProcess(jsonBody('https://youtube.com/watch?v=abc'))
  assert.equal(response.status, 422)

  const data = await response.json()
  assert.equal(data.error, 'UNSUPPORTED_WEBSITE')
})

test('TikTok URL without a video is rejected', async () => {
  const response = await postProcess(jsonBody('https://www.tiktok.com/@user'))
  assert.equal(response.status, 422)

  const data = await response.json()
  assert.equal(data.error, 'NOT_A_VIDEO_URL')
})

test('invalid JSON is rejected', async () => {
  const response = await postProcess('{bad')
  assert.equal(response.status, 400)

  const data = await response.json()
  assert.equal(data.error, 'INVALID_JSON')
})

test('wrong content type is rejected', async () => {
  const response = await request('/api/video/process', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'hello'
  })
  assert.equal(response.status, 415)

  const data = await response.json()
  assert.equal(data.error, 'UNSUPPORTED_MEDIA_TYPE')
})

test('oversized body is rejected', async () => {
  const response = await postProcess(jsonBody('x'.repeat(9000)))
  assert.equal(response.status, 413)

  const data = await response.json()
  assert.equal(data.error, 'PAYLOAD_TOO_LARGE')
})

test('process endpoint rejects non-POST methods', async () => {
  const response = await request('/api/video/process')
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('Allow'), 'POST, OPTIONS')
})

test('CORS preflight allows configured origins and media headers', async () => {
  const response = await request('/api/video/process', {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:3000' }
  })

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000')
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS')
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Range, If-Range')
  assert.match(response.headers.get('Access-Control-Expose-Headers'), /Content-Range/)
})

test('CORS does not allow unknown origins', async () => {
  const response = await request('/api/video/process', {
    method: 'OPTIONS',
    headers: { Origin: 'https://unknown.example' }
  })

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
})

test('download endpoint rejects invalid video ids', async () => {
  const response = await request('/api/video/download?videoId=abc')
  assert.equal(response.status, 400)

  const data = await response.json()
  assert.equal(data.error, 'INVALID_VIDEO_ID')
})

test('download endpoint rejects non-GET methods', async () => {
  const response = await request('/api/video/download?videoId=123', { method: 'POST' })
  assert.equal(response.status, 405)
  assert.equal(response.headers.get('Allow'), 'GET')
})

test('download endpoint stays disabled and invents no download URL', async () => {
  const response = await request('/api/video/download?videoId=123')
  assert.equal(response.status, 501)

  const data = await response.json()
  assert.equal(data.error, 'MEDIA_RETRIEVAL_NOT_CONFIGURED')
  assert.equal(data.available, false)
  assert.equal(data.downloadUrl, undefined)
})

test('fetchlayer cannot be enabled by configuration alone', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('provider must not be called')
  }

  try {
    const resolver = createMediaResolver('fetchlayer')
    const configuredEnv = { ...env, FETCHLAYER_API_KEY: 'test-key' }

    const resolved = await resolver(
      { url: 'https://www.tiktok.com/@user/video/123456789' },
      configuredEnv
    )
    assert.equal(resolved.status, 501)
    assert.equal(resolved.body.error, 'MEDIA_RETRIEVAL_NOT_CONFIGURED')

    const streamed = await resolver.stream({ videoId: '123' }, configuredEnv)
    assert.equal(streamed.status, 501)
    assert.equal(streamed.body.error, 'MEDIA_RETRIEVAL_NOT_CONFIGURED')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('streaming response forwards the upstream body without buffering', async () => {
  const chunks = [new TextEncoder().encode('chunk-1'), new TextEncoder().encode('chunk-2')]
  let index = 0

  const body = new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }

      controller.enqueue(chunks[index])
      index += 1
    }
  })

  const response = createVideoDownloadResponse(
    {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Disposition': 'attachment; filename="123.mp4"'
      },
      body
    },
    { 'Access-Control-Allow-Origin': 'http://localhost:3000' }
  )

  assert.equal(response.headers.get('Content-Type'), 'video/mp4')
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="123.mp4"')
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000')

  const reader = response.body.getReader()
  const received = []

  let done = false
  while (!done) {
    const chunk = await reader.read()
    done = chunk.done
    if (!done) received.push(new TextDecoder().decode(chunk.value))
  }

  assert.deepEqual(received, ['chunk-1', 'chunk-2'])
})

test('unknown routes return a consistent JSON error', async () => {
  const response = await request('/api/unknown')
  assert.equal(response.status, 404)

  const data = await response.json()
  assert.equal(data.ok, false)
  assert.equal(data.error, 'NOT_FOUND')
})

test('media resolver is not configured and invents no data', async () => {
  const result = await resolveMedia({ url: 'https://www.tiktok.com/@user/video/1' })

  assert.equal(result.status, 501)
  assert.equal(result.body.error, 'MEDIA_RETRIEVAL_NOT_CONFIGURED')
  assert.equal(result.body.available, false)
  assert.equal(result.body.downloadUrl, undefined)
})
