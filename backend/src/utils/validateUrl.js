const DEFAULT_ALLOWED_HOSTS = [
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com'
]

const SHORT_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com'])

export function getAllowedHosts(value) {
  if (!value) return DEFAULT_ALLOWED_HOSTS

  const hosts = String(value)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)

  return hosts.length ? hosts : DEFAULT_ALLOWED_HOSTS
}

function normalize(value) {
  if (value.startsWith('//')) return `https:${value}`
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value
  return `https://${value}`
}

export function validateUrl(input, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  const value = typeof input === 'string' ? input.trim() : ''

  if (!value) {
    return {
      valid: false,
      status: 400,
      error: 'EMPTY_URL',
      message: 'Please provide a TikTok video URL.'
    }
  }

  if (/\s/.test(value)) {
    return {
      valid: false,
      status: 400,
      error: 'INVALID_URL',
      message: 'The URL is not formatted correctly.'
    }
  }

  let url
  try {
    url = new URL(normalize(value))
  } catch {
    return {
      valid: false,
      status: 400,
      error: 'INVALID_URL',
      message: 'The URL is not formatted correctly.'
    }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      valid: false,
      status: 400,
      error: 'UNSUPPORTED_PROTOCOL',
      message: 'Only http and https URLs are supported.'
    }
  }

  const hostname = url.hostname.toLowerCase()
  const allowed = allowedHosts.map((host) => host.toLowerCase())
  if (!allowed.includes(hostname)) {
    return {
      valid: false,
      status: 422,
      error: 'UNSUPPORTED_WEBSITE',
      message: 'Only TikTok URLs are supported.'
    }
  }

  const path = url.pathname.replace(/\/+$/, '')
  const hasVideoPath = /\/video\/\d+/.test(path)
  const hasShortPath = /\/t\/[^/]+/.test(path)
  const hasShortHostPath = SHORT_HOSTS.has(hostname) && path.split('/').filter(Boolean).length > 0

  if (!hasVideoPath && !hasShortPath && !hasShortHostPath) {
    return {
      valid: false,
      status: 422,
      error: 'NOT_A_VIDEO_URL',
      message: 'The URL does not point to a TikTok video.'
    }
  }

  return { valid: true, url: value }
}
