const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com'
])

const SHORT_TIKTOK_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com'])

const MESSAGES = {
  empty: 'Please paste a TikTok link first.',
  invalid: 'That link is not formatted correctly. Please check it and try again.',
  protocol: 'Please use an http or https TikTok link.',
  unsupported: 'This is not a TikTok link. Please use a tiktok.com link.',
  notVideo: 'This TikTok link does not point to a video. Please paste a video link.'
}

export function normalizeLinkInput(input) {
  const value = String(input ?? '').trim()

  if (!value) return ''
  if (value.startsWith('//')) return `https:${value}`
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value

  return `https://${value}`
}

export function validateTikTokUrl(input) {
  const value = normalizeLinkInput(input)

  if (!value) {
    return { valid: false, reason: 'empty', message: MESSAGES.empty }
  }

  if (/\s/.test(value)) {
    return { valid: false, reason: 'invalid', message: MESSAGES.invalid }
  }

  let url
  try {
    url = new URL(value)
  } catch {
    return { valid: false, reason: 'invalid', message: MESSAGES.invalid }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, reason: 'protocol', message: MESSAGES.protocol }
  }

  const hostname = url.hostname.toLowerCase()
  if (!TIKTOK_HOSTS.has(hostname)) {
    return { valid: false, reason: 'unsupported', message: MESSAGES.unsupported }
  }

  const path = url.pathname.replace(/\/+$/, '')
  const hasVideoPath = /\/video\/\d+/.test(path)
  const hasShortPath = /\/t\/[^/]+/.test(path)
  const hasShortHostPath = SHORT_TIKTOK_HOSTS.has(hostname) && path.split('/').filter(Boolean).length > 0

  if (!hasVideoPath && !hasShortPath && !hasShortHostPath) {
    return { valid: false, reason: 'not-video', message: MESSAGES.notVideo }
  }

  return { valid: true, reason: '', message: '' }
}
