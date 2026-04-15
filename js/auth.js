// ══════════════════════════════════════════════════════════════════════════════
// AUTH — gerenciamento de sessão e login
// ══════════════════════════════════════════════════════════════════════════════

const AUTH = {
  getToken:     () => localStorage.getItem('cb_token'),
  getPapel:     () => localStorage.getItem('cb_papel'),
  getNome:      () => localStorage.getItem('cb_nome'),
  getClienteId: () => { const v = localStorage.getItem('cb_cliente_id'); return v ? parseInt(v) : null; },
  eAdmin:       () => localStorage.getItem('cb_papel') === 'admin',
  estaLogado:   () => !!localStorage.getItem('cb_token'),

  salvar(dados) {
    localStorage.setItem('cb_token', dados.token);
    localStorage.setItem('cb_papel', dados.papel);
    localStorage.setItem('cb_nome',  dados.nome || '');
    if (dados.clienteId) localStorage.setItem('cb_cliente_id', String(dados.clienteId));
    else localStorage.removeItem('cb_cliente_id');
  },

  limpar() {
    localStorage.removeItem('cb_token');
    localStorage.removeItem('cb_papel');
    localStorage.removeItem('cb_nome');
    localStorage.removeItem('cb_cliente_id');
  },

  logout() {
    AUTH.limpar();
    mostrarTelaLogin();
  }
};

// ── TELAS ──────────────────────────────────────────────────────────────────
function mostrarTelaLogin() {
  document.getElementById('tela-login').style.display    = '';
  document.getElementById('tela-clientes').style.display = 'none';
  document.getElementById('tela-app').style.display      = 'none';
  document.getElementById('login-email').value  = '';
  document.getElementById('login-senha').value  = '';
  document.getElementById('login-erro').textContent = '';
}

function mostrarTelaClientes() {
  document.getElementById('tela-login').style.display    = 'none';
  document.getElementById('tela-clientes').style.display = 'flex';
  document.getElementById('tela-app').style.display      = 'none';
}

function mostrarTelaApp() {
  document.getElementById('tela-login').style.display    = 'none';
  document.getElementById('tela-clientes').style.display = 'none';
  document.getElementById('tela-app').style.display      = 'block';
}

// ── LOGIN ──────────────────────────────────────────────────────────────────
async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  const btnEl  = document.getElementById('login-btn');

  if (!email || !senha) { erroEl.textContent = 'Preencha email e senha'; return; }

  btnEl.disabled = true;
  btnEl.textContent = 'Entrando...';
  erroEl.textContent = '';

  try {
    const dados = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
    AUTH.salvar(dados);
    aplicarModoUsuario();

    if (AUTH.eAdmin()) {
      await renderClientes();
      mostrarTelaClientes();
    } else {
      await iniciarComoCliente();
    }
  } catch (err) {
    erroEl.textContent = err.message || 'Erro ao fazer login';
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = 'Entrar';
  }
}

// Submete login com Enter
function loginKeydown(e) {
  if (e.key === 'Enter') fazerLogin();
}

// ── MODO USUÁRIO ──────────────────────────────────────────────────────────
function aplicarModoUsuario() {
  const isAdmin = AUTH.eAdmin();

  // Exibe/oculta elementos exclusivos do admin
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  // Exibe/oculta elementos exclusivos do cliente
  document.querySelectorAll('.cliente-only').forEach(el => {
    el.style.display = isAdmin ? 'none' : '';
  });

  // Nome do usuário no topbar
  const nomeEl = document.getElementById('topbar-usuario');
  if (nomeEl) nomeEl.textContent = AUTH.getNome() || (isAdmin ? 'Admin' : 'Cliente');
}

// ── FLUXO CLIENTE ──────────────────────────────────────────────────────────
async function iniciarComoCliente() {
  const clienteId = AUTH.getClienteId();
  if (!clienteId) { AUTH.logout(); return; }

  mostrarTelaApp();
  aplicarModoUsuario();
  await entrarCliente(clienteId);
  renderAll();
}
