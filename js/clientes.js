// ══════════════════════════════════════════════════════════════════════════════
// TELA DE CLIENTES
// ══════════════════════════════════════════════════════════════════════════════
let clientesCache = [];

async function renderClientes() {
  const lista = document.getElementById('clientes-lista');
  try {
    clientesCache = await API.listarClientes();
    if (!clientesCache.length) {
      lista.innerHTML = `<div class="clientes-empty"><div class="icon">👤</div><div>Nenhum cliente cadastrado ainda.</div></div>`;
      return;
    }
    lista.innerHTML = clientesCache.map(c => `
      <div class="cliente-card" onclick="entrarCliente(${c.id})">
        <div class="cliente-avatar" style="background:${c.cor}22;color:${c.cor}">${initials(c.nome)}</div>
        <div class="cliente-info">
          <div class="nome">${c.nome}</div>
          <div class="meta" style="color:var(--text2);font-size:12px">${c.obs || 'Clique para acessar'}</div>
        </div>
        <div class="cliente-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" title="Criar/editar acesso" onclick="abrirModalAcesso(${c.id},'${c.nome.replace(/'/g,"\\'")}')">🔑</button>
          <button class="btn btn-ghost btn-sm" onclick="abrirEditarClienteById(${c.id})">✏️</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="confirmarExcluirCliente(${c.id},'${c.nome}')">🗑</button>
        </div>
      </div>`).join('');
  } catch (err) {
    lista.innerHTML = `<div class="clientes-empty"><div class="icon">⚠️</div><div>Erro ao carregar clientes</div></div>`;
    console.error(err);
  }
}

async function entrarCliente(id) {
  clienteAtivo = clientesCache.find(c => c.id === id);
  if (!clienteAtivo) return;
  try {
    const [lans, cts, metasArr] = await Promise.all([
      API.listarLancamentos(id),
      API.listarContas(id),
      API.listarMetas(id),
    ]);
    lancamentos = lans;
    contas      = cts;
    // Converte array de metas para { [mesChave]: { [campo]: valor } }
    metasCache = {};
    metasArr.forEach(row => {
      if (!metasCache[row.mes_chave]) metasCache[row.mes_chave] = {};
      metasCache[row.mes_chave][row.campo] = parseFloat(row.valor);
    });
    // Carrega saldo inicial para todos os anos presentes
    const anos = [...new Set(lans.map(l => l.data.slice(0,4)))];
    if (!anos.includes(hoje().slice(0,4))) anos.push(hoje().slice(0,4));
    const saldoResults = await Promise.all(anos.map(a => API.buscarSaldo(id, a).catch(() => null)));
    saldosIniciais = {};
    anos.forEach((a, i) => {
      if (saldoResults[i]) saldosIniciais[a] = { valor: parseFloat(saldoResults[i].valor) || 0, mes: parseInt(saldoResults[i].mes) || 0 };
    });
  } catch (err) {
    console.error('Erro ao carregar dados do cliente:', err);
    lancamentos    = [];
    contas         = [];
    metasCache     = {};
    saldosIniciais = {};
  }
  nextId      = 1;
  nextContaId = 1;

  document.getElementById('chip-cliente').innerHTML = `
    <div class="chip-avatar" style="background:${clienteAtivo.cor}22;color:${clienteAtivo.cor}">${initials(clienteAtivo.nome)}</div>
    <span>${clienteAtivo.nome}</span>`;

  mostrarTelaApp();

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector('#page-dashboard').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn').classList.add('active');

  document.getElementById('f-data').value = hoje();
  popularCats('f-categoria', 'f-tipo');
  popularCats('e-categoria', 'e-tipo');
  popularDashAno();
  renderAll();
}

async function voltarClientes() {
  clienteAtivo = null; lancamentos = []; nextId = 1; contas = []; nextContaId = 1; metasCache = {}; saldosIniciais = {};
  await renderClientes();
  mostrarTelaClientes();
}

// ── NOVO / EDITAR CLIENTE ──
function abrirModalNovoCliente() {
  editandoClienteId = null;
  document.getElementById('modal-cliente-titulo').textContent = 'Novo Cliente';
  document.getElementById('btn-salvar-cliente').textContent = 'Criar';
  document.getElementById('c-nome').value = '';
  document.getElementById('c-obs').value = '';
  document.getElementById('c-cor').value = '#6c63ff';
  document.getElementById('modal-cliente').classList.add('open');
  setTimeout(() => document.getElementById('c-nome').focus(), 50);
}

function abrirEditarCliente() {
  if (!clienteAtivo) return;
  abrirEditarClienteById(clienteAtivo.id);
}

function abrirEditarClienteById(id) {
  const c = clientesCache.find(x => x.id === id);
  if (!c) return;
  editandoClienteId = id;
  document.getElementById('modal-cliente-titulo').textContent = 'Editar Cliente';
  document.getElementById('btn-salvar-cliente').textContent = 'Salvar';
  document.getElementById('c-nome').value = c.nome;
  document.getElementById('c-obs').value = c.obs || '';
  document.getElementById('c-cor').value = c.cor || '#6c63ff';
  document.getElementById('modal-cliente').classList.add('open');
  setTimeout(() => document.getElementById('c-nome').focus(), 50);
}

async function salvarCliente() {
  const nome = document.getElementById('c-nome').value.trim();
  if (!nome) { toast('Informe o nome', 'error'); return; }
  const dados = {
    nome,
    cor: document.getElementById('c-cor').value,
    obs: document.getElementById('c-obs').value.trim(),
  };
  try {
    if (editandoClienteId) {
      const atualizado = await API.editarCliente(editandoClienteId, dados);
      fecharModalCliente();
      if (clienteAtivo && clienteAtivo.id === editandoClienteId) {
        clienteAtivo = atualizado;
        document.getElementById('chip-cliente').innerHTML = `
          <div class="chip-avatar" style="background:${clienteAtivo.cor}22;color:${clienteAtivo.cor}">${initials(clienteAtivo.nome)}</div>
          <span>${clienteAtivo.nome}</span>`;
      }
      toast('Cliente atualizado');
    } else {
      await API.criarCliente(dados);
      fecharModalCliente();
      toast('Cliente criado — clique para entrar');
    }
    renderClientes();
  } catch (err) {
    toast('Erro ao salvar cliente', 'error');
    console.error(err);
  }
}

function fecharModalCliente() {
  document.getElementById('modal-cliente').classList.remove('open');
  editandoClienteId = null;
}

function confirmarExcluirCliente(id, nome) {
  document.getElementById('modal-confirmar-titulo').textContent = 'Excluir Cliente';
  document.getElementById('modal-confirmar-msg').textContent = `Excluir "${nome}" e todos os seus lançamentos permanentemente?`;
  document.getElementById('btn-confirmar-ok').onclick = () => { excluirCliente(id); fecharModal('modal-confirmar'); };
  document.getElementById('modal-confirmar').classList.add('open');
}

async function excluirCliente(id) {
  try {
    await API.excluirCliente(id);
    renderClientes();
    toast('Cliente excluído');
  } catch (err) {
    toast('Erro ao excluir cliente', 'error');
    console.error(err);
  }
}

// ── ACESSO DO CLIENTE ──
function abrirModalAcesso(clienteId, clienteNome) {
  document.getElementById('acesso-cliente-id').value    = clienteId;
  document.getElementById('acesso-cliente-nome').textContent = clienteNome;
  document.getElementById('acesso-email').value  = '';
  document.getElementById('acesso-senha').value  = '';
  document.getElementById('acesso-erro').textContent = '';
  document.getElementById('modal-acesso').classList.add('open');
}

async function salvarAcesso() {
  const clienteId = parseInt(document.getElementById('acesso-cliente-id').value);
  const email     = document.getElementById('acesso-email').value.trim();
  const senha     = document.getElementById('acesso-senha').value;
  const erroEl    = document.getElementById('acesso-erro');

  if (!email || !senha) { erroEl.textContent = 'Preencha email e senha'; return; }
  if (senha.length < 6)  { erroEl.textContent = 'Senha deve ter pelo menos 6 caracteres'; return; }

  try {
    await API.criarUsuario({ email, senha, clienteId, nome: clientesCache.find(c => c.id === clienteId)?.nome });
    fecharModal('modal-acesso');
    toast('Acesso criado com sucesso');
  } catch (err) {
    erroEl.textContent = err.message || 'Erro ao criar acesso';
  }
}
