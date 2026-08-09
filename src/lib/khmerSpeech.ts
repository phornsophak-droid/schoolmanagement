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

// Async check used to decide whether to show the "install Khmer voice" hint. Waits
// for voices to load so it doesn't false-negative on first paint.
export function hasKhmerVoice(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(false); return; }
    const synth = window.speechSynthesis;
    const check = () => synth.getVoices().some(isKhmer);
    if (synth.getVoices().length) { resolve(check()); return; }
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(check()); };
    synth.addEventListener?.('voiceschanged', finish, { once: true } as any);
    setTimeout(finish, 1800); // fallback if the event never fires
  });
}

export interface SpeakOpts { rate?: number; onStart?: () => void; onEnd?: () => void; onError?: () => void; }

// Speak Khmer text. SYNCHRONOUS on purpose (iOS blocks speech that isn't started
// directly inside a user gesture). Uses the Khmer voice if the cache has one,
// otherwise falls back to lang='km-KH' (works on devices where the Khmer voice is
// the system default even if not enumerated).
export function speakKhmer(text: string, opts: SpeakOpts = {}): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) { opts.onError?.(); return; }
  const synth = window.speechSynthesis;
  try {
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'km-KH';
    u.rate = opts.rate ?? 0.9;
    const voice = getKhmerVoice();
    if (voice) u.voice = voice;
    u.onstart = () => opts.onStart?.();
    u.onend = () => opts.onEnd?.();
    u.onerror = () => opts.onError?.();
    synth.speak(u);
  } catch { opts.onError?.(); }
}
