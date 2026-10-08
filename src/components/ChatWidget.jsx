import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useChat } from '../context/ChatContext';
import TextoFormatado from './TextoFormatado';
import BotaoMicrofone from './BotaoMicrofone';
import './ChatWidget.css';

export default function ChatWidget() {
  const { clienteAtivo } = useApp();
  const { mensagens, carregando, enviar, limpar } = useChat();
  const { pathname } = useLocation();
  const usuarioNome = sessionStorage.getItem('sf_nome') || '';
  const [aberto, setAberto] = useState(false);
  const [input, setInput]   = useState('');
  const fimRef   = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (aberto) {
      fimRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [aberto, mensagens, carregando]);

  // Na tela SOUZ AI o chat já ocupa a página inteira
  if (!clienteAtivo || pathname === '/chat') return null;

  function onSubmit(e) {
    e.preventDefault();
    if (!input.trim() || carregando) return;
    enviar(input);
    setInput('');
  }

  const boasVindas = `Olá${usuarioNome ? ', ' + usuarioNome.split(' ')[0] : ''}! Sou a SOUZ, assistente financeira da Souz Finance. Como posso ajudar com a gestão da sua loja hoje?`;

  return (
    <>
      <button
        className={`chat-fab${aberto ? ' chat-fab--ativo' : ''}`}
        onClick={() => setAberto(a => !a)}
        aria-label="Assistente financeiro"
        title="Assistente IA"
      >
        {aberto
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
        }
      </button>

      {aberto && (
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-header-dot" />
              <span className="chat-header-titulo">Assistente</span>
            </div>
            <div className="chat-header-acoes">
              <button onClick={limpar} className="chat-btn-icon" title="Limpar conversa">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              </button>
              <button onClick={() => setAberto(false)} className="chat-btn-icon" title="Fechar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div className="chat-mensagens">
            <div className="chat-msg chat-msg--assistant">
              <span className="chat-msg-texto"><TextoFormatado texto={boasVindas} /></span>
            </div>
            {mensagens.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg--${m.role}`}>
                <span className="chat-msg-texto">
                  {m.role === 'assistant' ? <TextoFormatado texto={m.content} /> : m.content}
                </span>
              </div>
            ))}
            {carregando && (
              <div className="chat-msg chat-msg--assistant">
                <span className="chat-digitando"><span /><span /><span /></span>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <form className="chat-input-area" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Ex: Vendi R$500 de iPhone hoje..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={carregando}
            />
            <BotaoMicrofone compacto disabled={carregando} onTexto={t => { setInput(a => (a.trim() ? `${a.trim()} ${t}` : t)); inputRef.current?.focus(); }} />
            <button type="submit" className="chat-enviar" disabled={!input.trim() || carregando}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
