import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';
import { API } from '../services/api';
import { blobParaBase64, formatoAudio } from '../services/gravacao';
import './ModoVoz.css';

const LIMIAR_MINIMO   = 0.015; // volume mínimo para contar como fala
const LIMIAR_MAXIMO   = 0.05;  // quem já começa falando não pode elevar a régua até a voz não contar
const FALA_MINIMA_MS  = 250;   // tosse ou batida na mesa não vira pergunta
const SILENCIO_FIM_MS = 1300;  // pausa que encerra a frase
const ESPERA_MAX_MS   = 30000; // ninguém falou: descarta e recomeça a gravação
const FALA_MAX_MS     = 45000;
const ESPERAS_COTA_MS = [10000, 20000]; // limite do Google é por minuto: espera sem interromper a conversa

const ROTULOS = {
  iniciando: 'Preparando o microfone',
  ouvindo:   'Estou ouvindo',
  entendendo: 'Entendendo',
  pensando:  'Pensando',
  falando:   'Toque para interromper',
  erro:      '',
};

// Cores das camadas da aurora em cada estado
const CORES = {
  iniciando:  [[16, 120, 95], [20, 110, 130], [40, 130, 90], [10, 90, 70]],
  ouvindo:    [[16, 185, 129], [34, 211, 238], [132, 230, 90], [5, 150, 105]],
  entendendo: [[56, 189, 248], [45, 212, 191], [99, 160, 248], [16, 185, 129]],
  pensando:   [[56, 189, 248], [45, 212, 191], [129, 140, 248], [16, 185, 129]],
  falando:    [[74, 222, 128], [190, 242, 100], [45, 212, 191], [16, 185, 129]],
  erro:       [[120, 130, 125], [90, 100, 96], [140, 148, 144], [70, 78, 74]],
};

function desenharAurora(ctx, tam, t, nivel, cores, agitacao) {
  const c = tam / 2;
  const PONTOS = 72;
  ctx.clearRect(0, 0, tam, tam);
  ctx.globalCompositeOperation = 'lighter';
  cores.forEach((cor, i) => {
    const base = tam * (0.2 - i * 0.012) * (1 + nivel * 0.34);
    const amp  = 0.2 + agitacao * 0.08 + nivel * 0.3;
    const orbita = tam * (0.075 + nivel * 0.05);
    const cx = c + Math.cos(t * 0.5 + i * 1.57) * orbita;
    const cy = c + Math.sin(t * 0.5 + i * 1.57) * orbita;
    const pts = [];
    for (let k = 0; k < PONTOS; k++) {
      const a = (k / PONTOS) * Math.PI * 2;
      const r = base * (1 + amp * (
        Math.sin(a * 2 + t * 0.9 + i * 1.7) * 0.5 +
        Math.sin(a * 3 - t * 1.3 + i) * 0.3 +
        Math.sin(a * 5 + t * 0.7 + i * 2.3) * 0.2));
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    ctx.beginPath();
    const meio = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const ini = meio(pts[PONTOS - 1], pts[0]);
    ctx.moveTo(ini[0], ini[1]);
    pts.forEach((p, k) => {
      const m = meio(p, pts[(k + 1) % PONTOS]);
      ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    });
    ctx.closePath();
    const [r, g, b] = cor.map(Math.round);
    const grad = ctx.createRadialGradient(cx, cy, base * 0.1, cx, cy, base * 1.35);
    grad.addColorStop(0, `rgba(${r},${g},${b},.5)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fill();
  });
}

async function gerarFala(clienteId, texto) {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await API.chatFalar(clienteId, { texto });
    } catch (e) {
      const espera = ESPERAS_COTA_MS[tentativa];
      if (espera === undefined || !/Muitos áudios/.test(e.message)) throw e;
      await new Promise(ok => setTimeout(ok, espera));
    }
  }
}

// Navegador pode deixar o áudio suspenso; resume() às vezes nunca responde, então não espera além de 1s
function acordarAudio(ac) {
  if (!ac || ac.state === 'running') return Promise.resolve();
  return Promise.race([ac.resume().catch(() => {}), new Promise(ok => setTimeout(ok, 1000))]);
}

// Conversa por voz: ouve, entende, responde falando e volta a ouvir. A conversa fica salva no chat
export default function ModoVoz({ onFechar }) {
  const { clienteAtivo } = useApp();
  const { enviar } = useChat();
  const [estado, setEstado]   = useState('iniciando');
  const [legenda, setLegenda] = useState('');
  const [erro, setErro]       = useState('');
  const [microfone, setMicrofone] = useState(false);

  const tela     = useRef(null);
  const fechar   = useRef(null);
  const ativo    = useRef(true);  // false depois de fechar: respostas atrasadas são ignoradas
  const stream   = useRef(null);
  const contexto = useRef(null);
  const entrada  = useRef(null);  // volume do microfone
  const saida    = useRef(null);  // volume da fala da IA
  const gravador = useRef(null);
  const quadro   = useRef(null);
  const audio    = useRef(null);
  const urlAudio = useRef(null);
  const nivelAlvo = useRef(0);
  const estadoRef = useRef('iniciando');
  const enviarRef = useRef(enviar);
  const ouvirRef  = useRef(null);
  useEffect(() => { enviarRef.current = enviar; }, [enviar]);
  useEffect(() => { estadoRef.current = estado; }, [estado]);

  const clienteId = clienteAtivo?.id;

  const medirVolume = useCallback(a => {
    if (!a) return 0;
    const dados = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(dados);
    return Math.sqrt(dados.reduce((s, v) => s + v * v, 0) / dados.length);
  }, []);

  const pulsar = useCallback(volume => { nivelAlvo.current = Math.min(1, volume * 7); }, []);

  const pararQuadro = useCallback(() => {
    cancelAnimationFrame(quadro.current);
    pulsar(0);
  }, [pulsar]);

  const falhar = useCallback(mensagem => {
    if (!ativo.current) return;
    pararQuadro();
    setErro(mensagem);
    setEstado('erro');
  }, [pararQuadro]);

  const responder = useCallback(async pergunta => {
    if (!ativo.current) return;
    setEstado('pensando');
    const resposta = await enviarRef.current(pergunta, { somenteConsulta: true });
    if (!ativo.current) return;
    if (!resposta) return falhar('Não consegui responder agora. Toque para tentar de novo.');
    try {
      const { audio: base64, mimeType } = await gerarFala(clienteId, resposta);
      if (!ativo.current) return;
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      if (urlAudio.current) URL.revokeObjectURL(urlAudio.current);
      urlAudio.current = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'audio/wav' }));
      audio.current.src = urlAudio.current;
      await acordarAudio(contexto.current);
      setEstado('falando');
      await audio.current.play();
      const acompanhar = () => {
        pulsar(medirVolume(saida.current) * 1.3);
        quadro.current = requestAnimationFrame(acompanhar);
      };
      acompanhar();
    } catch (e) {
      console.warn('[Voz] Falha ao tocar a resposta:', e.name, e.message);
      falhar(e.name === 'NotAllowedError' ? 'O navegador bloqueou o som. Toque para continuar.' : (e.message || 'A resposta está no chat, mas não consegui falar. Toque para continuar.'));
    }
  }, [clienteId, falhar, medirVolume, pulsar]);

  const entender = useCallback(async blob => {
    setEstado('entendendo');
    try {
      const { texto } = await API.chatTranscrever(clienteId, { audio: await blobParaBase64(blob), mimeType: blob.type, conversa: true });
      if (!ativo.current) return;
      if (!texto?.trim()) return ouvirRef.current();
      setLegenda(texto.trim());
      await responder(texto.trim());
    } catch (e) {
      falhar(e.message || 'Não consegui entender o áudio. Toque para tentar de novo.');
    }
  }, [clienteId, falhar, responder]);

  const ouvir = useCallback(() => {
    if (!ativo.current || !stream.current) return;
    pararQuadro();
    setErro('');
    setEstado('ouvindo');

    const mimeType = formatoAudio();
    const rec = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    const partes = [];
    let descartar = true;
    rec.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
    rec.onstop = () => {
      if (!ativo.current) return;
      if (descartar) return ouvirRef.current();
      entender(new Blob(partes, { type: rec.mimeType || mimeType || 'audio/webm' }));
    };
    gravador.current = rec;
    rec.start();

    const inicio = performance.now();
    let ruido = Infinity, limiar = LIMIAR_MINIMO;
    let falaDesde = 0, ultimaVoz = 0, falou = false;

    const passo = () => {
      const agora = performance.now();
      const volume = medirVolume(entrada.current);
      pulsar(volume);

      if (agora - inicio < 350) {
        // Mede o barulho do ambiente antes de valer como fala
        // Usa o menor volume: a pessoa pode já estar falando quando a tela abre
        ruido = Math.min(ruido, volume);
        limiar = Math.min(LIMIAR_MAXIMO, Math.max(LIMIAR_MINIMO, ruido * 2.5));
      } else if (volume > limiar) {
        ultimaVoz = agora;
        if (!falaDesde) falaDesde = agora;
        if (agora - falaDesde > FALA_MINIMA_MS) falou = true;
      } else if (!falou && falaDesde && agora - ultimaVoz > 400) {
        falaDesde = 0; // foi só um barulho
      }

      const terminou = falou && agora - ultimaVoz > SILENCIO_FIM_MS;
      const longaDemais = falou && agora - falaDesde > FALA_MAX_MS;
      const ninguemFalou = !falou && agora - inicio > ESPERA_MAX_MS;
      if (terminou || longaDemais || ninguemFalou) {
        descartar = ninguemFalou;
        pararQuadro();
        rec.stop();
        return;
      }
      quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
  }, [entender, medirVolume, pararQuadro, pulsar]);
  useEffect(() => { ouvirRef.current = ouvir; }, [ouvir]);

  // Aurora: roda o tempo todo e segue o volume e o estado da conversa
  useEffect(() => {
    const canvas = tela.current;
    const ctx = canvas.getContext('2d');
    const movimentoReduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tam = 640;
    canvas.width = tam;
    canvas.height = tam;
    let id, anterior = performance.now(), t = 0, nivel = 0, agitacao = 0;
    let cores = CORES.iniciando.map(c => [...c]);
    const animar = agora => {
      const dt = Math.min(0.05, (agora - anterior) / 1000);
      anterior = agora;
      const est = estadoRef.current;
      const pensando = est === 'pensando' || est === 'entendendo' || est === 'iniciando';
      nivel += (nivelAlvo.current - nivel) * 0.22;
      agitacao += ((pensando ? 1 : 0) - agitacao) * 0.06;
      cores = cores.map((c, i) => c.map((v, j) => v + (CORES[est][i][j] - v) * 0.05));
      t += dt * (1 + nivel * 2.2 + agitacao * 1.6) * (movimentoReduzido ? 0.15 : 1);
      desenharAurora(ctx, tam, t, nivel, cores, agitacao);
      id = requestAnimationFrame(animar);
    };
    id = requestAnimationFrame(animar);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    ativo.current = true;
    fechar.current?.focus();
    // Criado aqui, ainda dentro do clique que abriu a tela: o Safari só libera o áudio assim
    const el = new Audio();
    audio.current = el;
    el.onended = () => { cancelAnimationFrame(quadro.current); ouvirRef.current?.(); };
    let cancelado = false;
    // Também criado dentro do clique: depois do pedido de microfone o navegador pode deixá-lo suspenso
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ac = new Ctx();
    contexto.current = ac;

    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (cancelado) { s.getTracks().forEach(t => t.stop()); return; }
        stream.current = s;
        await acordarAudio(ac);
        if (cancelado) return;
        const a = ac.createAnalyser();
        a.fftSize = 1024;
        ac.createMediaStreamSource(s).connect(a);
        entrada.current = a;
        const b = ac.createAnalyser();
        b.fftSize = 1024;
        ac.createMediaElementSource(el).connect(b);
        b.connect(ac.destination);
        saida.current = b;
        setMicrofone(true);
        ouvirRef.current();
      } catch {
        if (cancelado) return;
        setErro('Libere o acesso ao microfone no navegador para conversar por voz.');
        setEstado('erro');
      }
    })();

    const urlRef = urlAudio;
    return () => {
      cancelado = true;
      ativo.current = false;
      cancelAnimationFrame(quadro.current);
      el.onended = null;
      el.pause();
      if (gravador.current?.state === 'recording') gravador.current.stop();
      stream.current?.getTracks().forEach(t => t.stop());
      stream.current = null;
      ac.close().catch(() => {});
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    function aoTeclar(e) { if (e.key === 'Escape') onFechar(); }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  function tocarAurora() {
    if (estado === 'falando') {
      audio.current.pause();
      cancelAnimationFrame(quadro.current);
      ouvir();
    } else if (estado === 'erro' && microfone) {
      ouvir();
    }
  }

  const clicavel = estado === 'falando' || (estado === 'erro' && microfone);
  const pensando = estado === 'iniciando' || estado === 'entendendo' || estado === 'pensando';

  return createPortal(
    <div className={`modo-voz modo-voz--${estado}`} role="dialog" aria-modal="true" aria-label="Conversa por voz com a SOUZ AI">
      <div className="modo-voz-topo">
        <button ref={fechar} type="button" className="modo-voz-fechar" onClick={onFechar} aria-label="Encerrar conversa por voz">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="modo-voz-centro">
        <button type="button" className="modo-voz-aurora" onClick={tocarAurora} disabled={!clicavel} aria-label={erro || ROTULOS[estado]}>
          <canvas ref={tela} aria-hidden="true" />
        </button>
        <p className="modo-voz-estado" role="status">
          {erro || ROTULOS[estado]}
          {pensando && !erro && <span className="modo-voz-pontos" aria-hidden="true"><i /><i /><i /></span>}
        </p>
        {legenda && <p className="modo-voz-legenda">{legenda}</p>}
      </div>

    </div>,
    document.body,
  );
}
