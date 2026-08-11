/**
 * Shared Khmer text-to-speech helper for the learning games.
 *
 * The games spoke Khmer via the Web Speech API with `lang='km-KH'`. That only makes
 * sound if the DEVICE has a Khmer TTS voice installed — most Android phones and
 * older iPhones don't, so the games came out silent even though speak() "succeeds"
 * (it falls back to a non-Khmer voice that can't pronounce Khmer script).
 *
 * This helper (1) loads the voice list properly — getVoices() is empty until the
 * async `voiceschanged` event, so a game that spoke on load never found the Khmer
 * voice even when one existed — and (2) exposes hasKhmerVoice() so a game can warn
 * the user and show how to enable Khmer TTS. speakKhmer() stays SYNCHRONOUS (no
 * await before speak) so iOS still treats it as user-gesture-initiated.
 */

let _voicesPrimed = false;

// Kick off voice loading early (call once on game mount). getVoices() populates
// asynchronously; touching it + listening for voiceschanged warms the cache so a
// later synchronous speakKhmer() can find the Khmer voice.
export function primeVoices(): void {
  if (_voicesPrimed || typeof window === 'undefined' || !window.speechSynthesis) return;
  _voicesPrimed = true;
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      window.speechSynthesis.getVoices();
    });
  } catch { /* speechSynthesis flaky on some browsers */ }
}

const isKhmer = (v: SpeechSynthesisVoice): boolean =>
  /km|khmer/i.test(v.lang) || /khmer|ខ្មែរ/i.test(v.name);

// Synchronous best-effort Khmer voice from the current cache (safe inside a click).
export function getKhmerVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  try { return window.speechSynthesis.getVoices().find(isKhmer) || null; } catch { return null; }
}

// Async check used to decide whether to show the "enable Khmer voice" hint. Waits
// for voices to load so it doesn't false-negative on first paint. (The Google TTS
// fallback is blocked in practice — returns non-audio — so we must not assume TTS
// always works; the hint is what lets a user fix it on their device.)
export function hasKhmerVoice(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(false); return; }
    const synth = window.speechSynthesis;
    const check = () => synth.getVoices().some(isKhmer);
    if (synth.getVoices().length) { resolve(check()); return; }
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(check()); };
    synth.addEventListener?.('voiceschanged', finish, { once: true } as any);
    setTimeout(finish, 1800);
  });
}

export interface SpeakOpts { rate?: number; onStart?: () => void; onEnd?: () => void; onError?: () => void; }

let activeAudio: HTMLAudioElement | null = null;

// Speak Khmer text. SYNCHRONOUS on purpose (iOS blocks speech that isn't started
// directly inside a user gesture). Uses the Khmer voice if the cache has one,
// otherwise falls back to Google Translate TTS API via HTML5 Audio (fixes iOS/Windows silence).
export function speakKhmer(text: string, opts: SpeakOpts = {}): void {
  if (typeof window === 'undefined') { opts.onError?.(); return; }
  
  const voice = getKhmerVoice();
  if (voice && window.speechSynthesis) {
    const synth = window.speechSynthesis;
    try {
      if (synth.speaking || synth.pending) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'km-KH';
      u.rate = opts.rate ?? 0.9;
      u.voice = voice;
      u.onstart = () => opts.onStart?.();
      u.onend = () => opts.onEnd?.();
      u.onerror = () => opts.onError?.();
      synth.speak(u);
    } catch { opts.onError?.(); }
  } else {
    // Fallback to Google Translate TTS API for iOS/Windows
    try {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      }
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=km&q=${encodeURIComponent(text)}`;
      const audio = new Audio(url);
      
      if (opts.rate) {
        audio.playbackRate = opts.rate;
      }
      
      audio.onplay = () => opts.onStart?.();
      audio.onended = () => opts.onEnd?.();
      audio.onerror = () => opts.onError?.();
      
      activeAudio = audio;
      audio.play().catch(() => opts.onError?.());
    } catch {
      opts.onError?.();
    }
  }
}
