import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useApp } from './AppContext';
import { API } from '../services/api';

const ChatContext = createContext(null);

// Uma conversa só para a tela SOUZ AI e para a bolinha flutuante; o histórico vem do Redis, o mesmo do WhatsApp
export function ChatProvider({ children }) {
  const { clienteAtivo, setLancamentos } = useApp();
  const [mensagens, setMensagens]   = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setMensagens([]);
    if (!clienteAtivo?.id) return;
    let ativo = true;
    API.chatHistorico(clienteAtivo.id)
      .then(r => { if (ativo) setMensagens(r.mensagens || []); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [clienteAtivo?.id]);

  const enviar = useCallback(async (texto) => {
    const msg = (texto || '').trim();
    if (!msg || carregando || !clienteAtivo?.id) return;
    setMensagens(m => [...m, { role: 'user', content: msg }]);
    setCarregando(true);
    try {
      const data = await API.chatEnviar(clienteAtivo.id, {
        mensagem: msg,
        clienteNome: clienteAtivo.nome,
        usuarioNome: sessionStorage.getItem('sf_nome') || '',
      });
      setMensagens(m => [...m, { role: 'assistant', content: data.resposta || 'Não entendi, pode reformular?', acao: data.acao }]);
      // Lançamento criado pela IA aparece nas outras telas sem precisar de F5
      if (data.acao) API.listarLancamentos(clienteAtivo.id).then(setLancamentos).catch(() => {});
    } catch (err) {
      setMensagens(m => [...m, { role: 'assistant', content: `Não consegui responder agora (${err.message}). Tente de novo em alguns segundos.`, erro: true }]);
    } finally {
      setCarregando(false);
    }
  }, [carregando, clienteAtivo, setLancamentos]);

  const limpar = useCallback(async () => {
    setMensagens([]);
    if (clienteAtivo?.id) await API.chatLimpar(clienteAtivo.id).catch(() => {});
  }, [clienteAtivo?.id]);

  return (
    <ChatContext.Provider value={{ mensagens, carregando, enviar, limpar }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
