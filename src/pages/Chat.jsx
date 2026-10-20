import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';
import TextoFormatado from '../components/TextoFormatado';
import BotaoMicrofone from '../components/BotaoMicrofone';
import { MESES_FULL } from '../services/utils';
import './Chat.css';

function nomeSaudacao(clienteAtivo) {
  // Admin olhando um cliente vê o nome da loja; o próprio cliente vê o primeiro nome dele
  if (sessionStorage.getItem('sf_papel') === 'admin') return clienteAtivo?.nome?.trim() || '';
  const nome = (sessionStorage.getItem('sf_nome') || '').trim();
  return nome ? nome.split(' ')[0] : (clienteAtivo?.nome?.trim() || '');
}

function sugestoes() {
  const mesPassado = MESES_FULL[(new Date().getMonth() + 11) % 12];
  return [
    { texto: `Como foi ${mesPassado.toLowerCase()}?`, enviar: true },
    { texto: 'Quanto gastei com fornecedores este mês?', enviar: true },
    { texto: 'Quais foram minhas vendas de iPhone esta semana?', enviar: true },
    { texto: 'Vendi um iPhone 15 por R$ 3.800 no Pix', enviar: false, rotulo: 'Registrar uma venda' },
  ];
}

export default function Chat() {
  const { clienteAtivo } = useApp();
  const { mensagens, carregando, enviar, limpar } = useChat();
  const [input, setInput] = useState('');
  const fimRef   = useRef(null);
  const inputRef = useRef(null);
  const vazio = mensagens.length === 0;

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens, carregando]);
  useEffect(() => { inputRef.current?.focus(); }, [clienteAtivo?.id]);

  function mandar(texto) {
    if (!texto.trim() || carregando) return;
    enviar(texto);
    setInput('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mandar(input); }
  }

  function receberDitado(texto) {
    setInput(atual => (atual.trim() ? `${atual.trim()} ${texto}` : texto));
    inputRef.current?.focus();
  }

  function usarSugestao(s) {
    if (s.enviar) return mandar(s.texto);
    setInput(s.texto);
    inputRef.current?.focus();
  }

  const nome = nomeSaudacao(clienteAtivo);

  const caixa = (
    <form className="souz-chat-caixa" onSubmit={e => { e.preventDefault(); mandar(input); }}>
      <textarea
        id="souz-chat-input"
        ref={inputRef}
        rows={1}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Pergunte sobre suas finanças ou registre um lançamento..."
        aria-label="Mensagem para a SOUZ AI"
        disabled={!clienteAtivo}
      />
      <BotaoMicrofone onTexto={receberDitado} disabled={carregando} />
      <button type="submit" className="souz-chat-enviar" disabled={!input.trim() || carregando} aria-label="Enviar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/></svg>
      </button>
    </form>
  );

  if (vazio) {
    return (
      <div className="souz-chat souz-chat--vazio">
        <div className="souz-chat-inicio">
          <div className="souz-chat-marca" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </div>
          <h1>Olá{nome ? `, ${nome}` : ''}! O que gostaria de saber hoje?</h1>
          <p>Pergunte sobre vendas, gastos e resultados, ou registre um lançamento escrevendo como falaria.</p>
          {caixa}
          <div className="souz-chat-sugestoes">
            {sugestoes().map(s => (
              <button key={s.texto} type="button" onClick={() => usarSugestao(s)} disabled={carregando || !clienteAtivo}>
                {s.rotulo || s.texto}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="souz-chat">
      <div className="souz-chat-topo">
        <span>SOUZ AI</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={limpar} disabled={carregando}>Nova conversa</button>
      </div>
      <div className="souz-chat-mensagens" aria-live="polite">
        {mensagens.map((m, i) => (
          <div key={i} className={`souz-msg souz-msg--${m.role}${m.erro ? ' souz-msg--erro' : ''}`}>
            {m.role === 'assistant'
              ? <div className="souz-msg-corpo"><TextoFormatado texto={m.content} /></div>
              : <div className="souz-msg-corpo">{m.content}</div>}
            {m.source === 'whatsapp' && <span className="souz-msg-canal">via WhatsApp</span>}
          </div>
        ))}
        {carregando && (
          <div className="souz-msg souz-msg--assistant">
            <div className="souz-msg-corpo"><span className="chat-digitando"><span /><span /><span /></span></div>
          </div>
        )}
        <div ref={fimRef} />
      </div>
      <div className="souz-chat-rodape">{caixa}</div>
    </div>
  );
}
