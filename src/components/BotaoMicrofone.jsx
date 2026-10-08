import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { API } from '../services/api';
import './BotaoMicrofone.css';

const LIMITE_SEGUNDOS = 60;
const FORMATOS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// Ditado: grava, a IA transcreve e o texto vai para a caixa — o usuário confere antes de enviar
export default function BotaoMicrofone({ onTexto, disabled, compacto = false }) {
  const { clienteAtivo } = useApp();
  const [estado, setEstado]     = useState('parado'); // parado | gravando | transcrevendo
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro]         = useState('');
  const gravador = useRef(null);
  const timer    = useRef(null);

  const suportado = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  useEffect(() => () => {
    clearInterval(timer.current);
    gravador.current?.stream?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => {
    if (!erro) return;
    const t = setTimeout(() => setErro(''), 5000);
    return () => clearTimeout(t);
  }, [erro]);

  async function iniciar() {
    setErro('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErro('Libere o acesso ao microfone no navegador para usar o ditado.');
      return;
    }
    const mimeType = FORMATOS.find(f => MediaRecorder.isTypeSupported?.(f)) || '';
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const partes = [];
    rec.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
    rec.onstop = async () => {
      clearInterval(timer.current);
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(partes, { type: rec.mimeType || mimeType || 'audio/webm' });
      if (blob.size < 1000) { setEstado('parado'); setErro('Não captei áudio. Segure um pouco mais e fale perto do microfone.'); return; }
      setEstado('transcrevendo');
      try {
        const { texto } = await API.chatTranscrever(clienteAtivo.id, { audio: await blobParaBase64(blob), mimeType: blob.type });
        if (texto) onTexto(texto);
        else setErro('Não entendi o áudio. Tente de novo falando mais perto do microfone.');
      } catch (e) {
        setErro(e.message || 'Não consegui transcrever. Tente de novo.');
      } finally {
        setEstado('parado');
      }
    };
    gravador.current = rec;
    rec.start();
    setSegundos(0);
    setEstado('gravando');
    timer.current = setInterval(() => setSegundos(s => s + 1), 1000);
  }

  function parar() {
    if (gravador.current?.state === 'recording') gravador.current.stop();
  }

  useEffect(() => {
    if (estado === 'gravando' && segundos >= LIMITE_SEGUNDOS) parar();
  }, [estado, segundos]);

  if (!suportado || !clienteAtivo) return null;

  const gravando = estado === 'gravando';
  const transcrevendo = estado === 'transcrevendo';
  const rotulo = gravando ? 'Parar e transcrever' : transcrevendo ? 'Transcrevendo...' : 'Falar em vez de digitar';
  const tempo = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;

  return (
    <div className={`mic ${compacto ? 'mic--compacto' : ''}`}>
      {gravando && <span className="mic-tempo" aria-live="polite">● {tempo}</span>}
      {transcrevendo && <span className="mic-tempo mic-tempo--neutro">Transcrevendo…</span>}
      <button
        type="button"
        className={`mic-botao${gravando ? ' mic-botao--gravando' : ''}`}
        onClick={gravando ? parar : iniciar}
        disabled={disabled || transcrevendo}
        aria-label={rotulo}
        title={rotulo}
        aria-pressed={gravando}
      >
        {transcrevendo
          ? <span className="mic-spinner" aria-hidden="true" />
          : gravando
            ? <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg>}
      </button>
      {erro && <div className="mic-erro" role="alert">{erro}</div>}
    </div>
  );
}
