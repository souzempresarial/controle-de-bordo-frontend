import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from './AppContext';
import { API } from '../services/api';

const ChatContext = createContext(null);

// Uma conversa só para a tela SOUZ AI e para a bolinha flutuante; o histórico vem do Redis, o mesmo do WhatsApp
export function ChatProvider({ children }) {
  const { clienteAtivo, setLancamentos } = useApp();
  const navigate = useNavigate();
  const [mensagens, setMensagens]   = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false); // bolinha flutuante, nas outras telas

  useEffect(() => {
    setMensagens([]);
    if (!clienteAtivo?.id) return;
    let ativo = true;
    API.chatHistorico(clienteAtivo.id)
      .then(r => { if (ativo) setMensagens(r.mensagens || []); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [clienteAtivo?.id]);

  // Devolve a resposta para quem precisa dela (conversa por voz); null se falhou
  const enviar = useCallback(async (texto, opcoes = {}) => {
    const msg = (texto || '').trim();
    if (!msg || carregando || !clienteAtivo?.id) return null;
    setMensagens(m => [...m, { role: 'user', content: msg }]);
    setCarregando(true);
    try {
      const data = await API.chatEnviar(clienteAtivo.id, {
        mensagem: msg,
        clienteNome: clienteAtivo.nome,
        usuarioNome: sessionStorage.getItem('sf_nome') || '',
        somenteConsulta: opcoes.somenteConsulta === true,
      });
      const resposta = data.resposta || 'Não entendi, pode reformular?';
      setMensagens(m => [...m, { role: 'assistant', content: resposta, acao: data.acao }]);
      // Lançamento criado pela IA aparece nas outras telas sem precisar de F5
      if (data.acao) API.listarLancamentos(clienteAtivo.id).then(setLancamentos).catch(() => {});
      // A conversa acompanha a pessoa: abre a bolinha na tela de destino (a tela do chat não tem bolinha)
      if (data.navegar) { setPainelAberto(data.navegar !== 'chat'); navigate(`/${data.navegar}`); }
      return resposta;
    } catch (err) {
      setMensagens(m => [...m, { role: 'assistant', content: `Não consegui responder agora (${err.message}). Tente de novo em alguns segundos.`, erro: true }]);
    } finally {
      setCarregando(false);
    }
  }, [carregando, clienteAtivo, setLancamentos, navigate]);

  const limpar = useCallback(async () => {
    setMensagens([]);
    if (clienteAtivo?.id) await API.chatLimpar(clienteAtivo.id).catch(() => {});
  }, [clienteAtivo?.id]);

  return (
    <ChatContext.Provider value={{ mensagens, carregando, enviar, limpar, painelAberto, setPainelAberto }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
