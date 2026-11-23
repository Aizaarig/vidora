const CLIPBOARD_DENIED_NAMES = new Set([
  'NotAllowedError',
  'PermissionDeniedError',
  'SecurityError'
])

const ERROR_MESSAGES = {
  EMPTY_URL: 'Please paste a TikTok link first.',
  INVALID_URL: 'That link is not formatted correctly. Please check it and try again.',
  UNSUPPORTED_PROTOCOL: 'Please use an http or https TikTok link.',
  UNSUPPORTED_WEBSITE: 'This is not a TikTok link. Please use a tiktok.com link.',
  NOT_A_VIDEO_URL: 'This TikTok link does not point to a video.',
  VIDEO_UNAVAILABLE: 'This video is not available for download.',
  DOWNLOADS_DISABLED: 'The creator has turned off downloads for this video.',
  INVALID_VIDEO_ID: 'That video could not be found. Please check the link and try again.',
  MEDIA_RETRIEVAL_NOT_CONFIGURED: 'Video retrieval is disabled until a provider is approved and configured.',
  PROVIDER_NOT_CONFIGURED: 'Video retrieval is disabled until a provider is approved and configured.',
  PROVIDER_UNAVAILABLE: 'The video provider is temporarily unavailable. Please try again shortly.',
  PROVIDER_ERROR: 'The video provider could not process that link. Please try again.'
}

export function getClipboardErrorMessage(error) {
  if (CLIPBOARD_DENIED_NAMES.has(error?.name)) {
    return 'Clipboard permission was denied. Please paste manually (Ctrl+V or Cmd+V).'
  }

  return 'Could not read the clipboard. Please paste manually (Ctrl+V or Cmd+V).'
}

export function getNetworkErrorMessage() {
  return 'We could not reach the video service. Check your connection and try again.'
}

export function getUnexpectedErrorMessage() {
  return 'Something went wrong. Please try again.'
}

function getStatusMessage(status) {
  if (status === 400 || status === 422) {
    return 'That link could not be processed. Please check it and try again.'
  }

  if (status === 404) {
    return 'That video could not be found. Please check the link and try again.'
  }

  if (status === 501) {
    return 'Video retrieval is disabled until a provider is approved and configured.'
  }

  if (status >= 500) {
    return 'The video service is temporarily unavailable. Please try again shortly.'
  }

  return 'We could not process that link. Please try again.'
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function getDownloadFromResponse(data) {
  if (data?.ok !== true || data?.available !== true) return null

  const url = data.downloadUrl
  if (typeof url !== 'string' || !/^\/api\/video\/download\?videoId=\d+$/.test(url)) {
    return null
  }

  const filename = typeof data.filename === 'string' && /^[\w.-]+\.mp4$/.test(data.filename)
    ? data.filename
    : 'video.mp4'

  return {
    url,
    filename,
    title: typeof data.video?.title === 'string' ? data.video.title.slice(0, 160) : ''
  }
}

export async function getResponseMessage(response) {
  const data = await readJson(response)

  if (!response.ok) {
    const code = typeof data?.error === 'string' ? data.error : ''
    return {
      text: ERROR_MESSAGES[code] || getStatusMessage(response.status),
      type: 'error',
      media: null
    }
  }

  if (data?.available === false) {
    return {
      text: ERROR_MESSAGES.VIDEO_UNAVAILABLE,
      type: 'error',
      media: null
    }
  }

  if (typeof data?.error === 'string') {
    return {
      text: ERROR_MESSAGES[data.error] || 'The video service could not complete that request.',
      type: 'error',
      media: null
    }
  }

  const media = getDownloadFromResponse(data)
  if (!media) {
    return {
      text: 'No downloadable video was returned. Please try another link.',
      type: 'info',
      media: null
    }
  }

  return {
    text: 'Video found. Use the download button below.',
    type: 'success',
    media
  }
}
