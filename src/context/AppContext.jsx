import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [clienteAtivo, setClienteAtivo] = useState(null);
  const [lancamentos, setLancamentos]   = useState([]);
  const [contas, setContas]             = useState([]);
  const [metasCache, setMetasCache]     = useState({});
  const [loading, setLoading]           = useState(false);
  const [erroEntrar, setErroEntrar]     = useState('');

  const entrarCliente = useCallback(async (cliente) => {
    setLoading(true);
    setErroEntrar('');
    try {
      const [lansRes, ctsRes, metasRes] = await Promise.allSettled([
        API.listarLancamentos(cliente.id),
        API.listarContas(cliente.id),
        API.listarMetas(cliente.id),
      ]);

      if (lansRes.status === 'rejected' || ctsRes.status === 'rejected') {
        setErroEntrar('Não foi possível carregar os dados do cliente. Verifique sua conexão e tente novamente.');
      }

      const lans     = lansRes.status  === 'fulfilled' ? lansRes.value  : [];
      const cts      = ctsRes.status   === 'fulfilled' ? ctsRes.value   : [];
      const metasArr = metasRes.status === 'fulfilled' ? metasRes.value : [];

      const mc = {};
      metasArr.forEach(m => {
        if (!mc[m.mes_chave]) mc[m.mes_chave] = {};
        mc[m.mes_chave][m.campo] = parseFloat(m.valor);
      });

      setClienteAtivo(cliente);
      setLancamentos(lans);
      setContas(cts);
      setMetasCache(mc);
      sessionStorage.setItem('sf_cliente_json', JSON.stringify(cliente));
    } finally {
      setLoading(false);
    }
  }, []);

  const sairCliente = useCallback(() => {
    setClienteAtivo(null);
    setLancamentos([]);
    setContas([]);
    setMetasCache({});
    sessionStorage.removeItem('sf_cliente_json');
  }, []);

  // Restaura cliente ativo ao recarregar a página
  useEffect(() => {
    const clienteJson = sessionStorage.getItem('sf_cliente_json');
    if (clienteJson) {
      try {
        const cliente = JSON.parse(clienteJson);
        entrarCliente(cliente);
      } catch {
        sessionStorage.removeItem('sf_cliente_json');
      }
    }
  }, []);

  return (
    <AppContext.Provider value={{
      clienteAtivo, lancamentos, setLancamentos,
      contas, setContas,
      metasCache, setMetasCache,
      loading, erroEntrar, entrarCliente, sairCliente,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
