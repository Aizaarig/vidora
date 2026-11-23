import { computed, ref } from 'vue'

import { validateTikTokUrl } from '../utils/tiktokUrl.js'
import {
  getClipboardErrorMessage,
  getNetworkErrorMessage,
  getResponseMessage,
  getUnexpectedErrorMessage
} from '../utils/videoService.js'

export function useVideoLink(apiBaseUrl = '/api') {
  const videoUrl = ref('')
  const message = ref('')
  const messageType = ref('info')
  const loading = ref(false)
  const media = ref(null)

  const isErrorMessage = computed(() => messageType.value === 'error')

  const downloadHref = computed(() => {
    if (!media.value?.url) return ''

    const baseUrl = String(apiBaseUrl || '/api').replace(/\/+$/, '')
    const path = baseUrl.endsWith('/api')
      ? media.value.url.replace(/^\/api(?=\/|$)/, '')
      : media.value.url

    return `${baseUrl}${path}`
  })

  function setMessage(text, type = 'info') {
    message.value = text
    messageType.value = type
  }

  function clearMessage() {
    message.value = ''
    messageType.value = 'info'
  }

  async function pasteLink() {
    if (loading.value) return

    clearMessage()
    media.value = null

    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      setMessage('Clipboard access is not available. Please paste manually (Ctrl+V or Cmd+V).', 'error')
      return
    }

    try {
      const pasted = (await navigator.clipboard.readText()).trim()

      if (!pasted) {
        setMessage('Your clipboard is empty. Copy a TikTok link first.', 'error')
        return
      }

      videoUrl.value = pasted

      const validation = validateTikTokUrl(pasted)
      if (!validation.valid) {
        setMessage(validation.message, 'error')
        return
      }

      setMessage('Link pasted. Ready to process.', 'info')
    } catch (error) {
      setMessage(getClipboardErrorMessage(error), 'error')
    }
  }

  function clearLink() {
    videoUrl.value = ''
    media.value = null
    clearMessage()
  }

  async function processLink() {
    if (loading.value) return

    clearMessage()
    media.value = null

    const validation = validateTikTokUrl(videoUrl.value)
    if (!validation.valid) {
      setMessage(validation.message, 'error')
      return
    }

    loading.value = true

    try {
      const baseUrl = String(apiBaseUrl || '/api').replace(/\/+$/, '')
      const response = await fetch(`${baseUrl}/video/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ url: videoUrl.value.trim() })
      })

      const result = await getResponseMessage(response)
      media.value = result.media || null
      setMessage(result.text, result.type)
    } catch (error) {
      setMessage(error instanceof TypeError ? getNetworkErrorMessage() : getUnexpectedErrorMessage(), 'error')
    } finally {
      loading.value = false
    }
  }

  return {
    videoUrl,
    message,
    isErrorMessage,
    loading,
    media,
    downloadHref,
    pasteLink,
    clearLink,
    processLink,
    clearMessage
  }
}
