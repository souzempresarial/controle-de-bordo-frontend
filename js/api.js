// ══════════════════════════════════════════════════════════════════════════════
// API — camada de comunicação com o backend
// ══════════════════════════════════════════════════════════════════════════════
const API_URL = 'https://controle-de-bordo-backend-production.up.railway.app';

// Normaliza campos que o PostgreSQL retorna em formato diferente
function normalizarLancamento(l) {
  return {
    ...l,
    data:          (l.data || '').slice(0, 10),
    isCMV:         l.is_cmv || false,
    grupoId:       l.grupo_id || null,
    valorRecebido: l.valor_recebido != null ? parseFloat(l.valor_recebido) : null,
    valor:         parseFloat(l.valor),
  };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
  return data;
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────
const API = {

  // Clientes
  listarClientes:  ()       => apiFetch('/clientes'),
  criarCliente:    (dados)  => apiFetch('/clientes', { method: 'POST', body: JSON.stringify(dados) }),
  editarCliente:   (id, dados) => apiFetch(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  excluirCliente:  (id)     => apiFetch(`/clientes/${id}`, { method: 'DELETE' }),

  // Lançamentos
  listarLancamentos: (cid)        => apiFetch(`/clientes/${cid}/lancamentos`).then(lans => lans.map(normalizarLancamento)),
  criarLancamento:   (cid, dados) => apiFetch(`/clientes/${cid}/lancamentos`, { method: 'POST', body: JSON.stringify(dados) }).then(normalizarLancamento),
  editarLancamento:  (id, dados)  => apiFetch(`/clientes/0/lancamentos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }).then(normalizarLancamento),
  excluirLancamento: (cid, id)    => apiFetch(`/clientes/${cid}/lancamentos/${id}`, { method: 'DELETE' }),
  limparLancamentos: (cid)        => apiFetch(`/clientes/${cid}/lancamentos`, { method: 'DELETE' }),

  // Contas
  listarContas:  (cid)        => apiFetch(`/clientes/${cid}/contas`),
  criarConta:    (cid, dados) => apiFetch(`/clientes/${cid}/contas`, { method: 'POST', body: JSON.stringify(dados) }),
  editarConta:   (cid, id, dados) => apiFetch(`/clientes/${cid}/contas/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  excluirConta:  (cid, id)    => apiFetch(`/clientes/${cid}/contas/${id}`, { method: 'DELETE' }),

  // Metas
  listarMetas: (cid)        => apiFetch(`/clientes/${cid}/metas`),
  salvarMeta:  (cid, dados) => apiFetch(`/clientes/${cid}/metas`, { method: 'POST', body: JSON.stringify(dados) }),

  // Saldo inicial
  buscarSaldo: (cid, ano)        => apiFetch(`/clientes/${cid}/saldo/${ano}`),
  salvarSaldo: (cid, ano, dados) => apiFetch(`/clientes/${cid}/saldo/${ano}`, { method: 'POST', body: JSON.stringify(dados) }),

};
