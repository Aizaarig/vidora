import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getClipboardErrorMessage,
  getDownloadFromResponse,
  getNetworkErrorMessage,
  getResponseMessage
} from '../app/utils/videoService.js'

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

test('clipboard permission denial has a clear message', () => {
  const message = getClipboardErrorMessage({ name: 'NotAllowedError' })
  assert.match(message, /permission was denied/i)
  assert.match(message, /paste manually/i)
})

test('other clipboard errors still suggest manual paste', () => {
  assert.match(getClipboardErrorMessage(new Error('unknown')), /paste manually/i)
})

test('network errors suggest checking the connection', () => {
  assert.match(getNetworkErrorMessage(), /Check your connection/i)
})

test('backend 5xx is reported as temporarily unavailable', async () => {
  const result = await getResponseMessage(new Response('', { status: 503 }))
  assert.equal(result.type, 'error')
  assert.match(result.text, /temporarily unavailable/i)
})

test('disabled retrieval is reported clearly', async () => {
  const result = await getResponseMessage(
    jsonResponse({ error: 'MEDIA_RETRIEVAL_NOT_CONFIGURED' }, 501)
  )
  assert.equal(result.type, 'error')
  assert.match(result.text, /disabled|approved|configured/i)
})

test('missing video is reported clearly', async () => {
  const result = await getResponseMessage(new Response('', { status: 404 }))
  assert.equal(result.type, 'error')
  assert.match(result.text, /could not be found/i)
})

test('backend video unavailable flag is reported', async () => {
  const result = await getResponseMessage(jsonResponse({ available: false }))
  assert.equal(result.type, 'error')
  assert.match(result.text, /not available for download/i)
})

test('creator-disabled downloads are reported', async () => {
  const result = await getResponseMessage(jsonResponse({ error: 'DOWNLOADS_DISABLED' }, 403))
  assert.equal(result.type, 'error')
  assert.match(result.text, /turned off downloads/i)
})

test('provider errors are reported clearly', async () => {
  const result = await getResponseMessage(jsonResponse({ error: 'PROVIDER_UNAVAILABLE' }, 503))
  assert.equal(result.type, 'error')
  assert.match(result.text, /temporarily unavailable/i)
})

test('bad link response from backend is reported', async () => {
  const result = await getResponseMessage(jsonResponse({ error: 'INVALID_URL' }, 400))
  assert.equal(result.type, 'error')
  assert.match(result.text, /not formatted/i)
})

test('verified worker download is exposed without claiming completion', async () => {
  const response = jsonResponse({
    ok: true,
    available: true,
    video: { id: '123', title: 'Clip', durationSeconds: 58 },
    downloadUrl: '/api/video/download?videoId=123',
    filename: '123.mp4'
  })

  const result = await getResponseMessage(response)
  assert.equal(result.type, 'success')
  assert.match(result.text, /Use the download button/i)
  assert.doesNotMatch(result.text, /downloaded/i)
  assert.deepEqual(result.media, {
    url: '/api/video/download?videoId=123',
    filename: '123.mp4',
    title: 'Clip'
  })
})

test('successful response does not invent media results', async () => {
  const result = await getResponseMessage(jsonResponse({ ok: true }))
  assert.equal(result.type, 'info')
  assert.match(result.text, /No downloadable video/i)
  assert.equal(result.media, null)
})

test('external provider URLs are never exposed as downloads', () => {
  const media = getDownloadFromResponse({
    ok: true,
    available: true,
    downloadUrl: 'https://provider.example/video.mp4'
  })

  assert.equal(media, null)
})
