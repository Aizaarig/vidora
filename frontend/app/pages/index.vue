<script setup>
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardPaste,
  Download,
  Link2,
  LoaderCircle,
  MousePointerClick,
  ShieldCheck,
  Smartphone,
  X
} from 'lucide-vue-next'

const config = useRuntimeConfig()

const {
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
} = useVideoLink(config.public.apiBaseUrl)

const statusIcon = computed(() => {
  if (loading.value) return LoaderCircle
  return isErrorMessage.value ? CircleAlert : CheckCircle2
})
</script>

<template>
  <main class="page">
    <header class="navbar">
      <a href="/" class="logo" aria-label="VIDORA home">
        <span class="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 44 44" focusable="false">
            <rect x="2" y="2" width="40" height="40" rx="14" fill="currentColor" />
            <path
              d="M18.4 14.2c0-1.1 1.2-1.78 2.14-1.21l10.5 6.35a1.4 1.4 0 0 1 0 2.42l-10.5 6.35a1.4 1.4 0 0 1-2.14-1.21V14.2Z"
              fill="#ffffff"
            />
          </svg>
        </span>
        VIDORA<span class="dot">.</span>
      </a>

      <span class="nav-label">VIDEO DOWNLOADER</span>
    </header>

    <section class="hero">
      <h1>
        Your videos.<br />
        <span>One simple link.</span>
      </h1>

      <p class="description">
        Paste your TikTok video link and let VIDORA
        do the work. Simple, fast and easy.
      </p>

      <div class="download-card">
        <label for="video-url">VIDEO LINK</label>

        <div class="input-wrapper">
          <span class="input-icon" aria-hidden="true">
            <Link2 :size="19" :stroke-width="2" />
          </span>

          <input
            id="video-url"
            v-model="videoUrl"
            type="url"
            inputmode="url"
            autocomplete="url"
            spellcheck="false"
            placeholder="Paste your TikTok link here..."
            :aria-invalid="isErrorMessage"
            :aria-describedby="message ? 'link-message' : undefined"
            @input="clearMessage"
            @keyup.enter="processLink"
          />

          <button
            v-if="videoUrl"
            type="button"
            class="action-btn clear-btn"
            aria-label="Clear link"
            :disabled="loading"
            @click="clearLink"
          >
            <X :size="16" :stroke-width="2" />
            <span>Clear</span>
          </button>

          <button
            v-else
            type="button"
            class="action-btn paste-btn"
            aria-label="Paste link"
            :disabled="loading"
            @click="pasteLink"
          >
            <ClipboardPaste :size="16" :stroke-width="2" />
            <span>Paste link</span>
          </button>
        </div>

        <button
          type="button"
          class="download-btn"
          :disabled="loading"
          @click="processLink"
        >
          <LoaderCircle
            v-if="loading"
            class="spin"
            :size="18"
            :stroke-width="2"
          />
          <Download v-else :size="18" :stroke-width="2" />
          <span>{{ loading ? 'Checking link...' : 'Process video' }}</span>
          <ArrowRight v-if="!loading" :size="17" :stroke-width="2" />
        </button>

        <p
          v-if="message"
          id="link-message"
          class="message"
          :class="{ error: isErrorMessage }"
          :role="isErrorMessage ? 'alert' : 'status'"
          :aria-live="isErrorMessage ? 'assertive' : 'polite'"
        >
          <component :is="statusIcon" :size="16" :stroke-width="2" />
          <span>{{ message }}</span>
        </p>

        <div v-if="media && downloadHref" class="result-card">
          <div class="result-heading">
            <CheckCircle2 :size="16" :stroke-width="2" />
            <span>Video ready</span>
          </div>

          <p v-if="media.title" class="result-title">{{ media.title }}</p>

          <a
            class="download-btn result-download"
            :href="downloadHref"
            :download="media.filename"
          >
            <Download :size="18" :stroke-width="2" />
            <span>Download MP4</span>
            <ArrowRight :size="17" :stroke-width="2" />
          </a>
        </div>

        <p class="privacy">
          <ShieldCheck :size="15" :stroke-width="2" aria-hidden="true" />
          <span>Only process videos you own or have permission to download.</span>
        </p>
      </div>

      <div class="features">
        <div>
          <span class="feature-icon">
            <MousePointerClick :size="17" :stroke-width="2" />
          </span>
          <span>Easy to use</span>
        </div>

        <div>
          <span class="feature-icon">
            <Smartphone :size="17" :stroke-width="2" />
          </span>
          <span>Mobile friendly</span>
        </div>

        <div>
          <span class="feature-icon">
            <CheckCircle2 :size="17" :stroke-width="2" />
          </span>
          <span>Simple workflow</span>
        </div>
      </div>
    </section>

    <section class="how-section">
      <p class="section-label">HOW IT WORKS</p>
      <h2>Three simple steps.</h2>

      <div class="steps">
        <article>
          <span class="step-icon">
            <Link2 :size="18" :stroke-width="2" />
          </span>
          <span class="step-number">01</span>
          <h3>Copy the link</h3>
          <p>Copy the link of the TikTok video you want to process.</p>
        </article>

        <article>
          <span class="step-icon">
            <ClipboardPaste :size="18" :stroke-width="2" />
          </span>
          <span class="step-number">02</span>
          <h3>Paste it here</h3>
          <p>Paste your video link into the VIDORA input field.</p>
        </article>

        <article>
          <span class="step-icon">
            <Download :size="18" :stroke-width="2" />
          </span>
          <span class="step-number">03</span>
          <h3>Process your video</h3>
          <p>Get a direct download link when the video is available.</p>
        </article>
      </div>
    </section>

    <footer>
      <a href="/" class="footer-logo">VIDORA.</a>
      <p>Made for a simpler video experience.</p>
      <span>© 2026 VIDORA</span>
    </footer>
  </main>
</template>

<style>
:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #17241e;
  background: #ffffff;
  color-scheme: light;
  --green: #16865b;
  --green-dark: #0f6d49;
  --green-soft: #eff8f2;
  --ink: #17241e;
  --muted: #718078;
  --border: #e5ebe7;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  -webkit-text-size-adjust: 100%;
}

button, input {
  font: inherit;
}

.page {
  min-height: 100vh;
  background: #ffffff;
}

.navbar {
  height: 76px;
  padding: 0 clamp(20px, 6vw, 84px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #edf1ee;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  color: var(--ink);
  text-decoration: none;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -0.045em;
}

.logo-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  color: var(--green);
  filter: drop-shadow(0 4px 8px rgba(22, 134, 91, 0.16));
}

.logo-mark svg {
  width: 100%;
  height: 100%;
  display: block;
}

.dot {
  color: var(--green);
}

.nav-label, .section-label {
  color: #87948d;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 1.5px;
}

.nav-label {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fbfcfb;
}

.hero {
  max-width: 900px;
  margin: auto;
  padding: 104px 22px 92px;
  text-align: center;
}

h1 {
  max-width: 780px;
  margin: 0 auto;
  font-size: clamp(44px, 7.4vw, 74px);
  line-height: 1.06;
  letter-spacing: -0.055em;
  font-weight: 800;
  text-wrap: balance;
}

h1 span {
  color: var(--green);
}

.description {
  max-width: 540px;
  margin: 22px auto 0;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.75;
}

.download-card {
  max-width: 660px;
  margin: 46px auto 0;
  padding: 27px;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 17px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(16, 52, 34, 0.08), 0 2px 8px rgba(16, 52, 34, 0.03);
}

.download-card label {
  display: block;
  margin-bottom: 13px;
  color: #78867e;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.2px;
}

.input-wrapper {
  min-height: 62px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 7px 9px 7px 13px;
  border: 1px solid #dce6df;
  border-radius: 11px;
  background: #ffffff;
  transition: border-color .2s, box-shadow .2s;
}

.input-wrapper:focus-within {
  border-color: rgba(22, 134, 91, 0.55);
  box-shadow: 0 0 0 4px rgba(22, 134, 91, 0.09);
}

.input-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: var(--green);
  background: var(--green-soft);
}

.input-wrapper input {
  width: 100%;
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  color: #24332a;
  background: transparent;
  font-size: 14px;
}

.input-wrapper input::placeholder {
  color: #a1ada5;
}

.action-btn {
  min-height: 38px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 12px;
  border: 1px solid #dcebe2;
  border-radius: 8px;
  background: #f6fbf8;
  color: var(--green);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background .2s, border-color .2s, transform .2s;
}

.action-btn:hover:not(:disabled) {
  border-color: #c8e2d3;
  background: var(--green-soft);
  transform: translateY(-1px);
}

.action-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.download-btn {
  width: 100%;
  height: 54px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: none;
  border-radius: 10px;
  color: #ffffff;
  background: var(--green);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(22, 134, 91, 0.2);
  transition: background .2s, box-shadow .2s, transform .2s;
}

.download-btn:hover:not(:disabled) {
  background: var(--green-dark);
  box-shadow: 0 10px 22px rgba(22, 134, 91, 0.26);
  transform: translateY(-1px);
}

.download-btn:disabled {
  opacity: .7;
  cursor: wait;
}

button:focus-visible, a:focus-visible {
  outline: 3px solid rgba(22, 134, 91, 0.25);
  outline-offset: 3px;
}

.message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 16px 0 0;
  padding: 11px 13px;
  border: 1px solid #d9eee2;
  border-radius: 9px;
  color: var(--green-dark);
  background: #f4faf6;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.message svg {
  flex-shrink: 0;
}

.message span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.message.error {
  border-color: #f4d7d2;
  color: #a4382c;
  background: #fff7f5;
}

.result-card {
  margin-top: 16px;
  padding: 15px;
  border: 1px solid #d9eee2;
  border-radius: 11px;
  background: #f8fcf9;
}

.result-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--green-dark);
  font-size: 13px;
  font-weight: 700;
}

.result-title {
  margin: 9px 0 0;
  color: #64756c;
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.result-download {
  height: 46px;
  margin-top: 13px;
  text-decoration: none;
}

.privacy {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 7px;
  margin: 18px 0 0;
  color: #939e97;
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}

.privacy svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--green);
}

.features {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 38px;
}

.features div {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 13px 8px 8px;
  border: 1px solid #e8eee9;
  border-radius: 10px;
  background: #ffffff;
  color: #56655d;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(16, 52, 34, 0.03);
}

.feature-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--green);
  background: var(--green-soft);
}

.how-section {
  padding: 76px clamp(20px, 8vw, 90px);
  border-top: 1px solid #edf2ef;
  background: #f8faf9;
  text-align: center;
}

.section-label {
  color: var(--green);
}

.how-section h2 {
  margin: 13px 0 35px;
  font-size: 31px;
  letter-spacing: -0.035em;
}

.steps {
  max-width: 960px;
  margin: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  text-align: left;
}

.steps article {
  padding: 24px;
  border: 1px solid #e7eee9;
  border-radius: 13px;
  background: #ffffff;
  box-shadow: 0 3px 14px rgba(16, 52, 34, 0.03);
}

.step-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: var(--green);
  background: var(--green-soft);
}

.step-number {
  display: block;
  margin-top: 18px;
  color: var(--green);
  font-size: 12px;
  font-weight: 800;
}

.steps h3 {
  margin: 10px 0 8px;
  font-size: 17px;
  letter-spacing: -0.015em;
}

.steps p {
  margin: 0;
  color: #849089;
  font-size: 13px;
  line-height: 1.7;
}

footer {
  padding: 30px clamp(20px, 8vw, 90px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  border-top: 1px solid #edf1ee;
}

.footer-logo {
  color: var(--green);
  font-weight: 800;
  letter-spacing: -0.03em;
  text-decoration: none;
}

footer p, footer span {
  color: #89958e;
  font-size: 11px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 701px) and (max-width: 900px) {
  .hero {
    padding: 88px 20px 76px;
  }

  .steps {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .navbar {
    height: 68px;
    padding: 0 20px;
  }

  .logo {
    font-size: 21px;
  }

  .logo-mark {
    width: 35px;
    height: 35px;
  }

  .nav-label {
    padding: 7px 9px;
    font-size: 9px;
    letter-spacing: 1px;
  }

  .hero {
    padding: 76px 18px 68px;
  }

  h1 {
    font-size: clamp(40px, 11vw, 58px);
    letter-spacing: -0.045em;
  }

  .description {
    margin-top: 18px;
    font-size: 15px;
  }

  .download-card {
    margin-top: 38px;
    padding: 19px;
    border-radius: 15px;
  }

  .features {
    margin-top: 30px;
  }

  .how-section {
    padding: 62px 20px;
  }

  .steps {
    grid-template-columns: 1fr;
  }

  footer {
    flex-direction: column;
    text-align: center;
  }
}

@media (max-width: 420px) {
  .action-btn {
    width: 38px;
    padding: 0;
  }

  .action-btn span {
    display: none;
  }

  .input-wrapper {
    gap: 8px;
    padding-left: 10px;
  }

  .features div {
    font-size: 11px;
  }

  .input-wrapper input {
    font-size: 16px;
  }
}

@media (max-width: 360px) {
  .nav-label {
    display: none;
  }

  .download-card {
    padding: 16px;
  }

  .input-wrapper {
    min-height: 56px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spin {
    animation: none;
  }
}
</style>
