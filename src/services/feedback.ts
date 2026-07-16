// 振動・効果音のフィードバック。ネイティブAPIのみ使用(追加アセット不要)。
export function vibrateFeedback(isCorrect: boolean): void {
  if (!("vibrate" in navigator)) return;
  navigator.vibrate(isCorrect ? 30 : [30, 60, 30]);
}

let audioCtx: AudioContext | null = null;

export function playFeedbackTone(isCorrect: boolean): void {
  const Ctx = window.AudioContext;
  if (!Ctx) return;
  audioCtx ??= new Ctx();
  const ctx = audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = isCorrect ? 880 : 220;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}
