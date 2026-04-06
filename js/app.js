// ══════════════════════════════════════════════════════════════════════════════
// TEMA
// ══════════════════════════════════════════════════════════════════════════════
(function() {
  if (localStorage.getItem('cb_tema') === 'light') document.body.classList.add('light');
})();
function alternarTema() {
  const light = document.body.classList.toggle('light');
  localStorage.setItem('cb_tema', light ? 'light' : 'dark');
  document.getElementById('btn-tema').textContent = light ? '☀️' : '🌙';
}
// Ajusta ícone ao carregar
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-tema');
  if (btn) btn.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
});

function popularCats(selId, tipoId) {
  const sel  = document.getElementById(selId);
  const tipo = tipoId ? (document.getElementById(tipoId)?.value || 'Saída') : 'Saída';
  const cats = getCatsPorTipo(tipo);
  const v    = sel.value;
  sel.innerHTML = '<option value="">— selecione —</option>' +
    Object.entries(cats).map(([cat, subs]) =>
      subs === null
        ? `<option disabled style="color:var(--text2);font-size:11px">${cat}</option>`
        : `<option${cat===v?' selected':''}>${cat}</option>`
    ).join('');
}

function atualizarSubs(catId, subId, valorAtual) {
  const cat  = document.getElementById(catId).value;
  const sub  = document.getElementById(subId);
  const subs = TODAS_CATEGORIAS[cat] || [];
  sub.innerHTML = '<option value="">— selecione —</option>' +
    subs.map(s => `<option${s===valorAtual?' selected':''}>${s}</option>`).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════
let clienteAtivo = null;
let lancamentos  = [];
let nextId       = 1;
let editandoId   = null;
let editandoClienteId = null;
let contas       = [];
let nextContaId  = 1;
let editandoContaId = null;

// ══════════════════════════════════════════════════════════════════════════════
// APP — NAVEGAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
function navTo(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (btn) btn.classList.add('active');
  renderAll();
}

function navFinanceiro(tab, btn) {
  ['dfc','dre','bp','proj'].forEach(t => {
    document.getElementById('fin-content-' + t).style.display = t === tab ? '' : 'none';
    document.getElementById('fin-tab-' + t).classList.toggle('active', t === tab);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  renderClientes();
});
