import assert from 'node:assert/strict'
import test from 'node:test'

import { useVideoLink } from '../app/composables/useVideoLink.js'

const VALID_URL = 'https://www.tiktok.com/@user/video/123456789'

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function stubNavigator(clipboard) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: clipboard ? { clipboard } : undefined
  })

  return () => {
    if (original) {
      Object.defineProperty(globalThis, 'navigator', original)
    } else {
      delete globalThis.navigator
    }
  }
}

function stubFetch(implementation) {
  const original = globalThis.fetch
  globalThis.fetch = implementation

  return () => {
    globalThis.fetch = original
  }
}

test('processing an empty input shows a validation message', async () => {
  const link = useVideoLink()
  const restoreFetch = stubFetch(() => {
    throw new Error('fetch should not be called')
  })

  try {
    await link.processLink()
  } finally {
    restoreFetch()
  }

  assert.equal(link.loading.value, false)
  assert.match(link.message.value, /paste a TikTok link first/i)
  assert.equal(link.isErrorMessage.value, true)
})

test('unsupported websites are rejected before any request', async () => {
  const link = useVideoLink()
  const restoreFetch = stubFetch(() => {
    throw new Error('fetch should not be called')
  })

  link.videoUrl.value = 'https://youtube.com/watch?v=123'

  try {
    await link.processLink()
  } finally {
    restoreFetch()
  }

  assert.match(link.message.value, /not a TikTok link/i)
  assert.equal(link.isErrorMessage.value, true)
})

test('clipboard permission errors do not crash the app', async () => {
  const restoreNavigator = stubNavigator({
    readText: async () => {
      const error = new Error('denied')
      error.name = 'NotAllowedError'
      throw error
    }
  })
  const link = useVideoLink()

  try {
    await link.pasteLink()
  } finally {
    restoreNavigator()
  }

  assert.equal(link.videoUrl.value, '')
  assert.match(link.message.value, /permission was denied/i)
  assert.match(link.message.value, /paste manually/i)
  assert.equal(link.isErrorMessage.value, true)
})

test('unavailable clipboard suggests manual paste', async () => {
  const restoreNavigator = stubNavigator(null)
  const link = useVideoLink()

  try {
    await link.pasteLink()
  } finally {
    restoreNavigator()
  }

  assert.match(link.message.value, /Clipboard access is not available/i)
  assert.equal(link.isErrorMessage.value, true)
})

test('pasting a valid link updates the input and clear resets state', async () => {
  const restoreNavigator = stubNavigator({ readText: async () => `  ${VALID_URL}  ` })
  const link = useVideoLink()

  try {
    await link.pasteLink()
  } finally {
    restoreNavigator()
  }

  assert.equal(link.videoUrl.value, VALID_URL)
  assert.match(link.message.value, /Ready to process/i)
  assert.equal(link.isErrorMessage.value, false)

  link.clearLink()

  assert.equal(link.videoUrl.value, '')
  assert.equal(link.message.value, '')
  assert.equal(link.isErrorMessage.value, false)
})

test('loading disables repeat submissions and resets when finished', async () => {
  let resolveRequest
  const requests = []
  const restoreFetch = stubFetch((url, options) => {
    requests.push({ url, options })
    return new Promise((resolve) => {
      resolveRequest = resolve
    })
  })
  const link = useVideoLink()
  link.videoUrl.value = VALID_URL

  try {
    const firstRequest = link.processLink()
    assert.equal(link.loading.value, true)

    await link.processLink()
    assert.equal(requests.length, 1)

    resolveRequest(new Response('', { status: 503 }))
    await firstRequest
  } finally {
    restoreFetch()
  }

  assert.equal(link.loading.value, false)
  assert.equal(requests[0].url, '/api/video/process')
  assert.equal(requests[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(requests[0].options.body), { url: VALID_URL })
  assert.match(link.message.value, /temporarily unavailable/i)
  assert.equal(link.isErrorMessage.value, true)
})

test('network failures show a connection message', async () => {
  const restoreFetch = stubFetch(async () => {
    throw new TypeError('Failed to fetch')
  })
  const link = useVideoLink()
  link.videoUrl.value = VALID_URL

  try {
    await link.processLink()
  } finally {
    restoreFetch()
  }

  assert.equal(link.loading.value, false)
  assert.match(link.message.value, /Check your connection/i)
  assert.equal(link.isErrorMessage.value, true)
})

test('video retrieval unavailable is reported clearly', async () => {
  const restoreFetch = stubFetch(async () =>
    jsonResponse({ error: 'MEDIA_RETRIEVAL_NOT_CONFIGURED' }, 501)
  )
  const link = useVideoLink()
  link.videoUrl.value = VALID_URL

  try {
    await link.processLink()
  } finally {
    restoreFetch()
  }

  assert.match(link.message.value, /disabled|approved|configured/i)
  assert.equal(link.isErrorMessage.value, true)
  assert.equal(link.media.value, null)
  assert.equal(link.downloadHref.value, '')
})

test('verified download response is exposed to the UI', async () => {
  const restoreFetch = stubFetch(async () =>
    jsonResponse({
      ok: true,
      available: true,
      video: { id: '123', title: 'Clip', durationSeconds: 58 },
      downloadUrl: '/api/video/download?videoId=123',
      filename: '123.mp4'
    })
  )
  const link = useVideoLink('https://example.test/api/')
  link.videoUrl.value = VALID_URL

  try {
    await link.processLink()
  } finally {
    restoreFetch()
  }

  assert.equal(link.isErrorMessage.value, false)
  assert.match(link.message.value, /Use the download button/i)
  assert.deepEqual(link.media.value, {
    url: '/api/video/download?videoId=123',
    filename: '123.mp4',
    title: 'Clip'
  })
  assert.equal(
    link.downloadHref.value,
    'https://example.test/api/video/download?videoId=123'
  )

  link.clearLink()
  assert.equal(link.media.value, null)
  assert.equal(link.downloadHref.value, '')
})

test('successful response without verified media invents no download', async () => {
  const restoreFetch = stubFetch(async () => jsonResponse({ ok: true }))
  const link = useVideoLink()
  link.videoUrl.value = VALID_URL

  try {
    await link.processLink()
  } finally {
    restoreFetch()
  }

  assert.equal(link.media.value, null)
  assert.equal(link.downloadHref.value, '')
  assert.match(link.message.value, /No downloadable video/i)
})

test('custom API base URL is used without duplicate slashes', async () => {
  let requestedUrl = ''
  const restoreFetch = stubFetch(async (url) => {
    requestedUrl = url
    return new Response('', { status: 404 })
  })
  const link = useVideoLink('https://example.test/api/')
  link.videoUrl.value = VALID_URL

  try {
    await link.processLink()
  } finally {
    restoreFetch()
  }

  assert.equal(requestedUrl, 'https://example.test/api/video/process')
})
