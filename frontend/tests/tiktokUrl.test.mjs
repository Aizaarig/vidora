import assert from 'node:assert/strict'
import test from 'node:test'

import { validateTikTokUrl } from '../app/utils/tiktokUrl.js'

const validUrls = [
  'https://www.tiktok.com/@user/video/1234567890123456789',
  'https://tiktok.com/@user/video/123',
  'http://www.tiktok.com/video/123',
  'https://m.tiktok.com/@user/video/123',
  'https://vm.tiktok.com/ZSabc123/',
  'https://vt.tiktok.com/-i/ZSabc123/',
  'https://www.tiktok.com/t/ZTRabc123/',
  'www.tiktok.com/@user/video/123',
  '//vm.tiktok.com/ZSabc123/'
]

for (const url of validUrls) {
  test(`accepts ${url}`, () => {
    assert.equal(validateTikTokUrl(url).valid, true)
  })
}

const invalidCases = [
  ['', 'empty'],
  ['   ', 'empty'],
  ['not a url', 'invalid'],
  ['https://www.tiktok.com/@user/video/123 with text', 'invalid'],
  ['https://', 'invalid'],
  ['ftp://www.tiktok.com/@user/video/123', 'protocol'],
  ['javascript:alert(1)', 'protocol'],
  ['https://youtube.com/watch?v=abc', 'unsupported'],
  ['https://www.tiktok.com.evil.com/@user/video/123', 'unsupported'],
  ['https://www.tiktok.com/@user', 'not-video'],
  ['https://vm.tiktok.com/', 'not-video']
]

for (const [input, reason] of invalidCases) {
  test(`rejects ${input || '(empty)'} as ${reason}`, () => {
    const result = validateTikTokUrl(input)
    assert.equal(result.valid, false)
    assert.equal(result.reason, reason)
    assert.ok(result.message.length > 0)
  })
}
