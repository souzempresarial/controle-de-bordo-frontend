import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [clienteAtivo, setClienteAtivo] = useState(null);
  const [lancamentos, setLancamentos]   = useState([]);
  const [contas, setContas]             = useState([]);
  const [metasCache, setMetasCache]     = useState({});
  const [loading, setLoading]           = useState(false);

  const entrarCliente = useCallback(async (cliente) => {
    setLoading(true);
    try {
      const [lans, cts, metasArr] = await Promise.all([
        API.listarLancamentos(cliente.id),
        API.listarContas(cliente.id),
        API.listarMetas(cliente.id),
      ]);

      const mc = {};
      metasArr.forEach(m => {
        if (!mc[m.mes_chave]) mc[m.mes_chave] = {};
        mc[m.mes_chave][m.campo] = parseFloat(m.valor);
      });

      setClienteAtivo(cliente);
      setLancamentos(lans);
      setContas(cts);
      setMetasCache(mc);
      localStorage.setItem('cb_cliente_json', JSON.stringify(cliente));
    } finally {
      setLoading(false);
    }
  }, []);

  const sairCliente = useCallback(() => {
    setClienteAtivo(null);
    setLancamentos([]);
    setContas([]);
    setMetasCache({});
    localStorage.removeItem('cb_cliente_json');
  }, []);

  // Restaura cliente ativo ao recarregar a página
  useEffect(() => {
    const token       = localStorage.getItem('cb_token');
    const clienteJson = localStorage.getItem('cb_cliente_json');
    if (token && clienteJson) {
      try {
        const cliente = JSON.parse(clienteJson);
        entrarCliente(cliente);
      } catch {
        localStorage.removeItem('cb_cliente_json');
      }
    }
  }, []);

  return (
    <AppContext.Provider value={{
      clienteAtivo, lancamentos, setLancamentos,
      contas, setContas,
      metasCache, setMetasCache,
      loading, entrarCliente, sairCliente,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
