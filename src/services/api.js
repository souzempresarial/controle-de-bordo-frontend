const API_URL = import.meta.env.PROD
  ? '/api'
  : 'https://kwgnbh1nbj.execute-api.sa-east-1.amazonaws.com';

function normalizarLancamento(l) {
  return {
    ...l,
    data:          (l.data || '').slice(0, 10),
    isCMV:         l.is_cmv || false,
    grupoId:       l.grupo_id || null,
    valorRecebido: l.valor_recebido != null ? parseFloat(l.valor_recebido) : null,
    valorUpgrade:  l.valor_upgrade  != null ? parseFloat(l.valor_upgrade)  : null,
    qtdUpgrade:    l.qtd_upgrade    != null ? parseInt(l.qtd_upgrade)      : null,
    valor:         parseFloat(l.valor),
  };
}

let _redirecionandoLogin = false;

async function apiFetch(path, options = {}) {
  const res = await fetch(API_URL + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 401) {
    if (!_redirecionandoLogin) {
      _redirecionandoLogin = true;
      sessionStorage.removeItem('sf_papel');
      sessionStorage.removeItem('sf_nome');
      sessionStorage.removeItem('sf_cliente_id');
      sessionStorage.removeItem('sf_cliente_json');
      window.location.href = '/login';
    }
    return new Promise(() => {});
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
  return data;
}

export const API = {
  // Auth
  login:    (dados) => apiFetch('/auth/login',   { method: 'POST', body: JSON.stringify(dados) }),
  logout:   ()      => apiFetch('/auth/logout',  { method: 'POST' }),
  registrar: (dados) => apiFetch('/auth/registro', { method: 'POST', body: JSON.stringify(dados) }),
  verificarEmail:       (token)          => apiFetch(`/auth/verificar/${token}`),
  reenviarVerificacao:  (email)          => apiFetch('/auth/reenviar-verificacao', { method: 'POST', body: JSON.stringify({ email }) }),
  esqueceuSenha:        (email)          => apiFetch('/auth/esqueci-senha', { method: 'POST', body: JSON.stringify({ email }) }),
  redefinirSenhaPorToken: (token, novaSenha) => apiFetch('/auth/redefinir-senha-token', { method: 'POST', body: JSON.stringify({ token, novaSenha }) }),
  minhaInfo:            ()               => apiFetch('/auth/me'),
  editarPerfil:         (dados)          => apiFetch('/auth/perfil', { method: 'PUT', body: JSON.stringify(dados) }),
  criarUsuario:         (dados)          => apiFetch('/auth/usuarios', { method: 'POST', body: JSON.stringify(dados) }),
  listarUsuarios:       ()               => apiFetch('/auth/usuarios'),
  excluirUsuario:       (id)             => apiFetch(`/auth/usuarios/${id}`, { method: 'DELETE' }),
  redefinirSenha:       (id, novaSenha)  => apiFetch(`/auth/usuarios/${id}/senha`, { method: 'PUT', body: JSON.stringify({ novaSenha }) }),

  // Admin
  ranking: (mes) => apiFetch(`/admin/ranking${mes ? `?mes=${mes}` : ''}`),

  // Clientes
  listarClientes:  ()           => apiFetch('/clientes'),
  criarCliente:    (dados)      => apiFetch('/clientes', { method: 'POST', body: JSON.stringify(dados) }),
  editarCliente:   (id, dados)  => apiFetch(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  excluirCliente:  (id)         => apiFetch(`/clientes/${id}`, { method: 'DELETE' }),

  // Lançamentos
  listarLancamentos: (cid)         => apiFetch(`/clientes/${cid}/lancamentos`).then(lans => lans.map(normalizarLancamento)),
  criarLancamento:   (cid, dados)  => apiFetch(`/clientes/${cid}/lancamentos`, { method: 'POST', body: JSON.stringify(dados) }).then(normalizarLancamento),
  editarLancamento:  (id, dados)   => apiFetch(`/clientes/0/lancamentos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }).then(normalizarLancamento),
  excluirLancamento: (cid, id)     => apiFetch(`/clientes/${cid}/lancamentos/${id}`, { method: 'DELETE' }),
  limparLancamentos: (cid)         => apiFetch(`/clientes/${cid}/lancamentos`, { method: 'DELETE' }),

  // Contas
  listarContas:  (cid)            => apiFetch(`/clientes/${cid}/contas`),
  criarConta:    (cid, dados)     => apiFetch(`/clientes/${cid}/contas`, { method: 'POST', body: JSON.stringify(dados) }),
  editarConta:   (cid, id, dados) => apiFetch(`/clientes/${cid}/contas/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  excluirConta:      (cid, id)   => apiFetch(`/clientes/${cid}/contas/${id}`, { method: 'DELETE' }),
  excluirContasBulk: (cid, cat)   => apiFetch(`/clientes/${cid}/contas/bulk${cat ? `?categoria=${encodeURIComponent(cat)}` : ``}`, { method: 'DELETE' }),

  // Metas
  listarMetas: (cid)        => apiFetch(`/clientes/${cid}/metas`),
  salvarMeta:  (cid, dados) => apiFetch(`/clientes/${cid}/metas`, { method: 'POST', body: JSON.stringify(dados) }),

  // Saldo inicial
  buscarSaldo: (cid, ano)        => apiFetch(`/clientes/${cid}/saldo/${ano}`),
  salvarSaldo: (cid, ano, dados) => apiFetch(`/clientes/${cid}/saldo/${ano}`, { method: 'POST', body: JSON.stringify(dados) }),

  // Recursos em Capital
  buscarCapital: (cid, mes)        => apiFetch(`/clientes/${cid}/capital/${mes}`),
  salvarCapital: (cid, mes, dados) => apiFetch(`/clientes/${cid}/capital/${mes}`, { method: 'POST', body: JSON.stringify(dados) }),

  // Upgrade
  listarAparelhos:  (cid)            => apiFetch(`/clientes/${cid}/upgrade`),
  criarAparelho:    (cid, dados)     => apiFetch(`/clientes/${cid}/upgrade`, { method: 'POST', body: JSON.stringify(dados) }),
  editarAparelho:   (cid, id, dados) => apiFetch(`/clientes/${cid}/upgrade/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  excluirAparelho:  (cid, id)        => apiFetch(`/clientes/${cid}/upgrade/${id}`, { method: 'DELETE' }),
  venderAparelho:   (cid, id, dados) => apiFetch(`/clientes/${cid}/upgrade/${id}/vender`, { method: 'POST', body: JSON.stringify(dados) }),

  // Extrato
  processarExtrato: async (cid, arquivo, dataInicio, dataFim) => {
    const { token } = await apiFetch('/auth/token-extrato', { method: 'POST' });
    const form = new FormData();
    form.append('arquivo', arquivo);
    if (dataInicio) form.append('dataInicio', dataInicio);
    if (dataFim)    form.append('dataFim',    dataFim);
    return fetch(`https://e5dyozgewxfhwitb6dpm5e2fbm0wobrh.lambda-url.sa-east-1.on.aws/clientes/${cid}/extrato/processar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }).then(async r => {
      const texto = await r.text();
      try { return JSON.parse(texto); }
      catch { throw new Error('O processamento demorou demais. Tente novamente — PDFs muito grandes podem levar mais tempo.'); }
    });
  },
  salvarRegrasExtrato: (cid, transacoes) =>
    apiFetch(`/clientes/${cid}/extrato/regras`, { method: 'POST', body: JSON.stringify({ transacoes }) }),
};