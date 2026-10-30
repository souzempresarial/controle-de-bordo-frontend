// Gravação de áudio no navegador: usada pelo ditado e pela conversa por voz
export const FORMATOS_AUDIO = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function formatoAudio() {
  return FORMATOS_AUDIO.find(f => MediaRecorder.isTypeSupported?.(f)) || '';
}

export function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
