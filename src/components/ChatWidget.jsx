import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import './ChatWidget.css';

const API_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_DEV_API || 'https://kwgnbh1nbj.execute-api.sa-east-1.amazonaws.com');

export default function ChatWidget() {
  const { clienteAtivo } = useApp();
  const [aberto, setAberto]       = useState(false);
  const [mensagens, setMensagens] = useState([]);
  const [input, setInput]         = useState('');
  const [carregando, setCarregando] = useState(false);
  const fimRef  = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (clienteAtivo) {
      setMensagens([{
        role: 'assistant',
        content: `Olá, ${clienteAtivo.nome}! Pode me dizer o que deseja lançar, por exemplo: "Vendi R$500 de iPhone no cartão hoje".`,
      }]);
    }
  }, [clienteAtivo?.id]);

  useEffect(() => {
    if (aberto) {
      fimRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [aberto, mensagens]);

  if (!clienteAtivo) return null;

  async function enviar(e) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || carregando) return;

    const novasMensagens = [...mensagens, { role: 'user', content: texto }];
    setMensagens(novasMensagens);
    setInput('');
    setCarregando(true);

    // histórico sem a msg de boas-vindas (só as reais)
    const historico = novasMensagens.slice(1, -1);

    try {
      const res = await fetch(`${API_URL}/clientes/${clienteAtivo.id}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: texto, historico, clienteNome: clienteAtivo.nome }),
      });

      const resBody = await res.text();
      let data;
      try { data = JSON.parse(resBody); } catch { throw new Error(resBody.slice(0, 120)); }
      if (!res.ok) throw new Error(data.detalhe || data.erro || 'Erro no servidor');
      setMensagens(m => [...m, { role: 'assistant', content: data.resposta || 'Não entendi, pode reformular?' }]);
    } catch (err) {
      setMensagens(m => [...m, { role: 'assistant', content: `Erro: ${err.message}` }]);
    } finally {
      setCarregando(false);
    }
  }

  function limpar() {
    setMensagens([{
      role: 'assistant',
      content: `Olá, ${clienteAtivo.nome}! Pode me dizer o que deseja lançar, por exemplo: "Vendi R$500 de iPhone no cartão hoje".`,
    }]);
  }

  return (
    <>
      {/* Botão flutuante */}
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

      {/* Painel de chat */}
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
            {mensagens.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg--${m.role}`}>
                <span className="chat-msg-texto">{m.content}</span>
              </div>
            ))}
            {carregando && (
              <div className="chat-msg chat-msg--assistant">
                <span className="chat-digitando">
                  <span /><span /><span />
                </span>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <form className="chat-input-area" onSubmit={enviar}>
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Ex: Vendi R$500 de iPhone hoje..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={carregando}
            />
            <button type="submit" className="chat-enviar" disabled={!input.trim() || carregando}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
