// ══════════════════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════════════════
function calcularTotais(lista) {
  const cmvCats = Object.keys(CATEGORIAS_CMV);
  let entradas = 0, saidas = 0;
  lista.filter(l => !l.isCMV && !cmvCats.includes(l.categoria) && !(l.tipo==='Saída' && l.status==='Pendente')).forEach(l => {
    if (l.tipo === 'Entrada') entradas += (l.valorRecebido ?? l.valor);
    else if (l.tipo === 'Saída') saidas += l.valor;
  });
  return { entradas, saidas, saldo: entradas - saidas };
}

function calcularMetricasPeriodo(filtrados) {
  const _cmvCats   = Object.keys(CATEGORIAS_CMV);
  const _sgaCats   = ['Deduções das Vendas','Custos Variáveis Indiretos','Despesas com Ocupação','Despesas com Pessoal','Despesas Variáveis','Softwares / Tecnologias','Serviços Terceirizados'];
  const _naoOpCats = ['Dívidas / Empréstimos','Saídas Não-Operacionais'];
  const fat        = filtrados.filter(l => l.tipo==='Entrada' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
  const cmvTotal   = filtrados.filter(l => l.isCMV || _cmvCats.includes(l.categoria)).reduce((a,l) => a + l.valor, 0);
  const sgaMes     = filtrados.filter(l => l.tipo==='Saída' && _sgaCats.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
  const naoOpMes   = filtrados.filter(l => l.tipo==='Saída' && _naoOpCats.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
  const despTotal  = filtrados.filter(l => l.tipo==='Saída' && !l.isCMV && !_cmvCats.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
  const lucroLiq   = fat - cmvTotal - sgaMes - naoOpMes;
  const custosTotal= cmvTotal + sgaMes + naoOpMes;
  const vendas     = filtrados.filter(l => l.tipo==='Entrada' && !l.isCMV);
  const unidades   = vendas.reduce((a,l) => a + (l.quantidade || 1), 0);
  const ticket     = vendas.length > 0 ? fat / unidades : null;
  return { fat, cmvTotal, sgaMes, naoOpMes, despTotal, lucroLiq, custosTotal, vendas, unidades, ticket };
}

function renderAll() {
  renderCards();
  renderKPIs();
  renderTabelaDash();
  renderTabela();
  renderRelatorio();
  renderRegras();
  renderContas();
  renderBalanco();
  renderDRE();
  renderFluxo();
  try { renderProjecaoBar(); } catch(e) { console.error('renderProjecaoBar:', e); }
  try { renderProjecao(); } catch(e) { console.error('renderProjecao:', e); }
  atualizarTopbar();
  atualizarFiltros();
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTAS A RECEBER / PAGAR
// ══════════════════════════════════════════════════════════════════════════════
function renderContas() {
  const pendR = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente');
  const pendP = contas.filter(c => c.tipo === 'pagar'   && c.status === 'pendente');
  const totR  = pendR.reduce((a,c) => a + c.valor, 0);
  const totP  = pendP.reduce((a,c) => a + c.valor, 0);

  document.getElementById('contas-receber-total').textContent = pendR.length
    ? `${pendR.length} pendente${pendR.length>1?'s':''} · Total: ${fmt(totR)}`
    : '';
  document.getElementById('contas-pagar-total').textContent = pendP.length
    ? `${pendP.length} pendente${pendP.length>1?'s':''} · Total: ${fmt(totP)}`
    : '';

  const th = (txt, align='left') =>
    `<th style="padding:9px 13px;text-align:${align};font-size:11px;color:var(--text2);text-transform:uppercase;border-bottom:1px solid var(--border)">${txt}</th>`;

  const vencBadge = (venc) => {
    if (!venc) return '<span style="color:var(--text2);font-size:12px">—</span>';
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const d = new Date(venc + 'T00:00:00');
    const diff = Math.round((d - hoje) / 86400000);
    const label = fmtData(venc);
    if (diff < 0)  return `<span style="color:var(--saida);font-weight:700;font-size:12px">${label} (vencida)</span>`;
    if (diff === 0) return `<span style="color:var(--warn);font-weight:700;font-size:12px">${label} (hoje)</span>`;
    if (diff <= 3)  return `<span style="color:var(--warn);font-size:12px">${label} (${diff}d)</span>`;
    return `<span style="font-size:12px">${label}</span>`;
  };

  const buildTabela = (lista, cor, tipoLabel) => {
    if (!lista.length) return `<div class="empty-state"><div class="icon">✅</div><div>Nenhuma conta a ${tipoLabel} pendente</div></div>`;
    return `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th('Vencimento')}${th('Descrição')}${th('Categoria')}${th('Valor', 'right')}${th('')}</tr></thead>
      <tbody>${lista.map(c => `
        <tr>
          <td style="padding:9px 13px;border-bottom:1px solid var(--border)">${vencBadge(c.vencimento)}</td>
          <td style="padding:9px 13px;font-size:13px;border-bottom:1px solid var(--border)">${c.descricao||'—'}${c.recorrente ? `<span style="margin-left:6px;font-size:10px;font-weight:700;color:var(--accent);background:#22c55e18;padding:2px 6px;border-radius:10px;text-transform:uppercase">${c.periodicidade}</span>` : ''}</td>
          <td style="padding:9px 13px;font-size:13px;border-bottom:1px solid var(--border);color:var(--text2)">${c.categoria||'—'}</td>
          <td style="padding:9px 13px;font-size:13px;border-bottom:1px solid var(--border);text-align:right;color:${cor};font-weight:700">${fmt(c.valor)}</td>
          <td style="padding:9px 13px;border-bottom:1px solid var(--border);text-align:right">
            <div style="display:flex;gap:6px;justify-content:flex-end">
              <button class="btn btn-primary btn-sm" onclick="quitarConta(${c.id})">Quitar</button>
              <button class="btn btn-ghost btn-sm" onclick="editarConta(${c.id})">✏️</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--saida)" onclick="excluirConta(${c.id})">🗑</button>
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  };

  document.getElementById('contas-receber-tabela').innerHTML = buildTabela(pendR, 'var(--entrada)', 'receber');
  document.getElementById('contas-pagar-tabela').innerHTML   = buildTabela(pendP, 'var(--saida)',   'pagar');
}

async function quitarConta(id) {
  const c = contas.find(c => c.id === id);
  if (!c) return;

  const tipoLanc = c.tipo === 'receber' ? 'Entrada' : 'Saída';
  const dadosLanc = {
    tipo: tipoLanc,
    descricao: c.descricao,
    valor: c.valor,
    data: hoje(),
    categoria: c.categoria || (tipoLanc === 'Saída' ? 'Despesas Variáveis' : 'Aparelhos'),
    subcategoria: c.subcategoria || '',
    status: 'Confirmado',
  };

  try {
    // Marca como quitada
    await API.editarConta(clienteAtivo.id, id, { ...c, status: 'quitado' });
    const idx = contas.findIndex(c => c.id === id);
    if (idx !== -1) contas[idx].status = 'quitado';

    // Cria lançamento correspondente
    const novoLanc = await API.criarLancamento(clienteAtivo.id, dadosLanc);
    lancamentos.unshift(novoLanc);

    // Gera próxima se recorrente
    if (c.recorrente && c.periodicidade && c.vencimento) {
      const d = new Date(c.vencimento + 'T00:00:00');
      if (c.periodicidade === 'mensal')       d.setMonth(d.getMonth() + 1);
      else if (c.periodicidade === 'semanal') d.setDate(d.getDate() + 7);
      else if (c.periodicidade === 'anual')   d.setFullYear(d.getFullYear() + 1);
      const novaVenc = d.toISOString().split('T')[0];
      const novaConta = await API.criarConta(clienteAtivo.id, { tipo: c.tipo, descricao: c.descricao, valor: c.valor, vencimento: novaVenc, categoria: c.categoria, subcategoria: c.subcategoria || '', recorrente: true, periodicidade: c.periodicidade });
      contas.push(novaConta);
      toast('Conta quitada — lançamento criado e próxima gerada');
    } else {
      toast('Conta quitada — lançamento criado');
    }

    renderAll();
  } catch (err) {
    toast('Erro ao quitar conta', 'error');
    console.error(err);
  }
}

async function excluirConta(id) {
  try {
    await API.excluirConta(clienteAtivo.id, id);
    contas = contas.filter(c => c.id !== id);
    renderAll();
    toast('Conta excluída');
  } catch (err) {
    toast('Erro ao excluir conta', 'error');
    console.error(err);
  }
}

function editarConta(id) {
  const c = contas.find(c => c.id === id);
  if (!c) return;
  editandoContaId = id;
  setContaTipo(c.tipo); // popula o select de categorias antes de setar o valor
  document.getElementById('conta-desc').value  = c.descricao  || '';
  document.getElementById('conta-valor').value = c.valor      || '';
  document.getElementById('conta-venc').value  = c.vencimento || '';
  document.getElementById('conta-cat').value   = c.categoria  || '';
  atualizarSubsConta();
  document.getElementById('conta-subcat').value = c.subcategoria || '';
  document.getElementById('conta-recorrente').checked = !!c.recorrente;
  document.getElementById('conta-periodicidade').value = c.periodicidade || 'mensal';
  document.getElementById('conta-periodicidade-wrap').style.display = c.recorrente ? '' : 'none';
  document.getElementById('conta-modal-titulo').textContent = 'Editar Conta';
  document.getElementById('modal-conta').classList.add('open');
}

function popularSelectMes(selId, callback) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const atual = sel.value || hoje().slice(0,7);
  const meses = [...new Set(lancamentos.map(l => l.data.slice(0,7)))].sort().reverse();
  if (!meses.includes(atual)) meses.unshift(hoje().slice(0,7));
  sel.innerHTML = meses.map(m => {
    const [y,mo] = m.split('-');
    const label = new Date(y, mo-1).toLocaleString('pt-BR',{month:'long',year:'numeric'});
    return `<option value="${m}"${m===atual?' selected':''}>${label}</option>`;
  }).join('');
  sel.onchange = callback;
}

// ══════════════════════════════════════════════════════════════════════════════
// REGRAS
// ══════════════════════════════════════════════════════════════════════════════
function renderRegras() {
  const el = document.getElementById('regras-lista');
  if (!el) return;
  const regras = DB.getRegras(clienteAtivo.id);
  if (!regras.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">⚡</div><div>Nenhuma regra salva ainda.<br><span style="font-size:12px">Corrija uma categoria na importação e marque "Lembrar".</span></div></div>';
    return;
  }
  el.innerHTML = `<table><thead><tr>
    <th>Palavra-chave</th><th>Categoria</th><th>Subcategoria</th><th>Criada em</th><th></th>
  </tr></thead><tbody>${regras.map(r => `<tr>
    <td><strong>${r.palavra}</strong></td>
    <td>${r.categoria}</td>
    <td style="color:var(--text2)">${r.subcategoria||'—'}</td>
    <td style="color:var(--text2);font-size:12px">${r.criadaEm ? new Date(r.criadaEm).toLocaleDateString('pt-BR') : '—'}</td>
    <td><button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="excluirRegra('${r.id}')">🗑</button></td>
  </tr>`).join('')}</tbody></table>`;
}

function excluirRegra(id) {
  const regras = DB.getRegras(clienteAtivo.id).filter(r => String(r.id) !== String(id));
  DB.saveRegras(clienteAtivo.id, regras);
  renderRegras();
  toast('Regra removida');
}

// ══════════════════════════════════════════════════════════════════════════════
// CARDS / TOPBAR / TABELAS
// ══════════════════════════════════════════════════════════════════════════════
function renderCards() {
  const mes  = getDashMes();
  const tm   = calcularTotais(lancamentos.filter(l => l.data.startsWith(mes)));

  const [ano, m] = mes.split('-');
  const prevMes  = parseInt(m) === 1
    ? `${parseInt(ano)-1}-12`
    : `${ano}-${String(parseInt(m)-1).padStart(2,'0')}`;
  const tp = calcularTotais(lancamentos.filter(l => l.data.startsWith(prevMes)));
  const countPrev = lancamentos.filter(l => l.data.startsWith(prevMes)).length;

  const fat     = lancamentos.filter(l => l.data.startsWith(mes)     && l.tipo==='Entrada' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
  const fatPrev = lancamentos.filter(l => l.data.startsWith(prevMes) && l.tipo==='Entrada' && !l.isCMV).reduce((a,l) => a + l.valor, 0);

  const cmvCats    = Object.keys(CATEGORIAS_CMV);
  const cmvMes     = lancamentos.filter(l => l.data.startsWith(mes)     && (l.isCMV || cmvCats.includes(l.categoria))).reduce((a,l) => a + l.valor, 0);
  const cmvPrevMes = lancamentos.filter(l => l.data.startsWith(prevMes) && (l.isCMV || cmvCats.includes(l.categoria))).reduce((a,l) => a + l.valor, 0);
  const margBruta     = fat > 0     ? ((fat - cmvMes) / fat * 100) : 0;
  const margBrutaPrev = fatPrev > 0 ? ((fatPrev - cmvPrevMes) / fatPrev * 100) : 0;

  document.getElementById('cards-resumo').innerHTML = `
    <div class="card c-entrada">
      <div class="card-label">Faturamento do Mês</div>
      <div class="card-value" style="color:var(--entrada)">${fmt(fat)}</div>
      <div class="card-sub">Mês anterior: <span style="color:var(--entrada)">${fmt(fatPrev)}</span></div>
    </div>
    <div class="card c-saida">
      <div class="card-label">Saídas do Mês</div>
      <div class="card-value" style="color:var(--saida)">${fmt(tm.saidas)}</div>
      <div class="card-sub">Mês anterior: <span style="color:var(--saida)">${fmt(tp.saidas)}</span></div>
    </div>
    <div class="card c-saldo">
      <div class="card-label">Saldo do Mês</div>
      <div class="card-value" style="color:${tm.saldo>=0?'var(--entrada)':'var(--saida)'}">${fmt(tm.saldo)}</div>
      <div class="card-sub">Mês anterior: <span style="color:${tp.saldo>=0?'var(--entrada)':'var(--saida)'}">${fmt(tp.saldo)}</span></div>
    </div>
    <div class="card c-count">
      <div class="card-label">Margem Bruta</div>
      <div class="card-value" style="color:${margBruta>=0?'var(--entrada)':'var(--saida)'}">${margBruta.toFixed(2)}%</div>
      <div class="card-sub">Mês anterior: <span style="color:${margBrutaPrev>=0?'var(--entrada)':'var(--saida)'}">${margBrutaPrev.toFixed(2)}%</span></div>
    </div>`;
}

function atualizarTopbar() {
  const t = calcularTotais(lancamentos);
  const eEl = document.getElementById('top-entrada');
  const sEl = document.getElementById('top-saida');
  const bEl = document.getElementById('top-saldo');
  eEl.textContent = fmt(t.entradas); eEl.style.color = 'var(--entrada)';
  sEl.textContent = fmt(t.saidas);   sEl.style.color = 'var(--saida)';
  bEl.textContent = fmt(t.saldo);    bEl.style.color = t.saldo >= 0 ? 'var(--entrada)' : 'var(--saida)';
}

function criarTabela(lista, maxRows) {
  if (!lista.length) return '<div class="empty-state"><div class="icon">📭</div><div>Nenhum lançamento encontrado</div></div>';
  // Remove CMVs autogerados — serão exibidos inline na entrada vinculada
  const semCMV = lista.filter(l => !l.isCMV);
  const rows   = maxRows ? semCMV.slice(0, maxRows) : semCMV;
  return `<table><thead><tr>
    <th>ID</th><th>Data</th><th>Tipo</th><th>Categoria</th><th>Subcategoria</th>
    <th>Descrição</th><th>Pagamento</th><th>Status</th><th style="text-align:right">Valor</th><th></th>
  </tr></thead><tbody>${rows.map(l => {
    // Busca CMV vinculado (mesmo grupoId, isCMV:true)
    const cmv = l.grupoId ? lancamentos.find(x => x.grupoId === l.grupoId && x.isCMV) : null;
    const cmvInfo = cmv ? (() => {
      const lucro  = l.valor - cmv.valor;
      const margem = l.valor > 0 ? (lucro / l.valor * 100).toFixed(2) : 0;
      return `<div style="margin-top:4px;display:flex;gap:10px;flex-wrap:wrap;font-size:11px">
        <span style="background:#f03e3e18;color:var(--saida);border-radius:4px;padding:1px 7px;font-weight:600">CMV ${fmt(cmv.valor)}</span>
        <span style="color:${lucro>=0?'var(--entrada)':'var(--saida)'}">Lucro ${fmt(lucro)}</span>
        <span style="color:${margem>=30?'var(--entrada)':margem>=15?'var(--warn)':'var(--saida)'}">Margem ${margem}%</span>
      </div>`;
    })() : '';
    return `<tr>
    <td class="id-cell">#${String(l.id).padStart(3,'0')}</td>
    <td style="white-space:nowrap">${fmtData(l.data)}</td>
    <td><span class="tipo-badge tipo-${l.tipo}">${l.tipo}</span></td>
    <td>${l.categoria}</td>
    <td style="color:var(--text2)">${l.subcategoria||'—'}</td>
    <td>${l.descricao}${cmvInfo}</td>
    <td style="color:var(--text2)">${l.pagamento||'—'}</td>
    <td><span style="font-size:11px;color:${l.status==='Pendente'?'var(--warn)':'var(--text2)'}">${l.status}</span></td>
    <td class="valor-cell" style="text-align:right;color:${l.tipo==='Entrada'?'var(--entrada)':l.tipo==='Saída'?'var(--saida)':'var(--transferencia)'}">
      ${l.tipo==='Entrada'?'+':l.tipo==='Saída'?'-':''}${fmt(l.valor)}
    </td>
    <td class="actions-cell">
      <button class="btn btn-ghost btn-sm" onclick="abrirEditar(${l.id})">✏️</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="confirmarExcluir(${l.id})">🗑</button>
    </td>
  </tr>`;}).join('')}</tbody></table>`;
}

function renderTabelaDash() {
  const mes = getDashMes();
  const filtrados = lancamentos.filter(l => l.data.startsWith(mes));
  document.getElementById('tabela-dash').innerHTML = criarTabela(filtrados, 50);
}

function renderTabela() {
  const busca = (document.getElementById('busca')?.value||'').toLowerCase();
  const ft    = document.getElementById('filtro-tipo')?.value||'';
  const fc    = document.getElementById('filtro-cat')?.value||'';
  const fm    = document.getElementById('filtro-mes')?.value||'';
  let lista = [...lancamentos];
  if (ft) lista = lista.filter(l => l.tipo === ft);
  if (fc) lista = lista.filter(l => l.categoria === fc);
  if (fm) lista = lista.filter(l => l.data.startsWith(fm));
  if (busca) lista = lista.filter(l =>
    l.descricao.toLowerCase().includes(busca) ||
    l.categoria.toLowerCase().includes(busca) ||
    (l.subcategoria||'').toLowerCase().includes(busca) ||
    String(l.id).includes(busca));
  document.getElementById('tabela-full').innerHTML = criarTabela(lista);
}

function atualizarFiltros() {
  const cats  = [...new Set(lancamentos.map(l => l.categoria))].sort();
  const meses = [...new Set(lancamentos.map(l => l.data.slice(0,7)))].sort().reverse();
  const fc = document.getElementById('filtro-cat');
  const fm = document.getElementById('filtro-mes');
  if (!fc || !fm) return;
  const vcat = fc.value, vmes = fm.value;
  fc.innerHTML = '<option value="">Todas categorias</option>' + cats.map(c=>`<option${c===vcat?' selected':''}>${c}</option>`).join('');
  fm.innerHTML = '<option value="">Todos os meses</option>' + meses.map(m => {
    const [y,mo] = m.split('-');
    const label  = new Date(y,mo-1).toLocaleString('pt-BR',{month:'long',year:'numeric'});
    return `<option value="${m}"${m===vmes?' selected':''}>${label}</option>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// KPIs + METAS
// ══════════════════════════════════════════════════════════════════════════════
function getMetas() {
  return metasCache;
}

async function saveMeta(mesChave, field, valor) {
  if (!metasCache[mesChave]) metasCache[mesChave] = {};
  metasCache[mesChave][field] = parseFloat(valor) || 0;
  try {
    await API.salvarMeta(clienteAtivo.id, { mes_chave: mesChave, campo: field, valor: parseFloat(valor) || 0 });
  } catch (err) {
    console.error('Erro ao salvar meta:', err);
  }
  renderKPIs();
}

function getDashMes() {
  const mesEl = document.getElementById('dash-mes');
  const anoEl = document.getElementById('dash-ano');
  if (!mesEl || !anoEl || !anoEl.value) return hoje().slice(0, 7);
  return `${anoEl.value}-${mesEl.value}`;
}

function popularDashAno() {
  const el = document.getElementById('dash-ano');
  if (!el) return;
  const anos = [...new Set(lancamentos.map(l => l.data.slice(0,4)))].sort().reverse();
  if (!anos.includes(hoje().slice(0,4))) anos.unshift(hoje().slice(0,4));
  el.innerHTML = anos.map(a => `<option${a===hoje().slice(0,4)?' selected':''}>${a}</option>`).join('');
  const mesEl = document.getElementById('dash-mes');
  if (mesEl) mesEl.value = hoje().slice(5,7);
}

function renderKPIs() {
  const kpiEl   = document.getElementById('cards-kpi');
  const metasEl = document.getElementById('metas-dash');
  if (!kpiEl || !metasEl) return;

  const cmvCats  = Object.keys(CATEGORIAS_CMV);
  const mes      = getDashMes();
  const lm       = lancamentos.filter(l => l.data.startsWith(mes));

  // Receita bruta do mês (DRE — valor completo, não valorRecebido)
  const receitaMes   = lm.filter(l => l.tipo==='Entrada').reduce((a,l) => a + l.valor, 0);
  const cmvMes       = lm.filter(l => l.isCMV || cmvCats.includes(l.categoria)).reduce((a,l) => a + l.valor, 0);
  const lucroBruto   = receitaMes - cmvMes;
  const margemBruta  = receitaMes > 0 ? (lucroBruto / receitaMes * 100) : null;
  const vendasMes    = lm.filter(l => l.tipo==='Entrada');
  const unidadesMes  = vendasMes.reduce((a,l) => a + (l.quantidade || 1), 0);
  const ticketMedio  = vendasMes.length > 0 ? receitaMes / unidadesMes : null;
  const cmvPct       = receitaMes > 0 ? (cmvMes / receitaMes * 100) : null;

  const fmtPct  = v => v !== null ? v.toFixed(2) + '%' : '—';
  const corMar  = margemBruta === null ? 'var(--text2)' : margemBruta >= 30 ? 'var(--entrada)' : margemBruta >= 15 ? 'var(--warn)' : 'var(--saida)';
  const corCMV  = cmvPct === null ? 'var(--text2)' : cmvPct <= 60 ? 'var(--entrada)' : cmvPct <= 75 ? 'var(--warn)' : 'var(--saida)';

  kpiEl.innerHTML = `
    <div class="card">
      <div class="card-label">Margem Bruta — Período</div>
      <div class="card-value" style="color:${corMar}">${fmtPct(margemBruta)}</div>
      <div class="card-sub">Lucro Bruto: <span style="color:${lucroBruto>=0?'var(--entrada)':'var(--saida)'}">${fmt(lucroBruto)}</span></div>
    </div>
    <div class="card">
      <div class="card-label">Ticket Médio — Período</div>
      <div class="card-value" style="color:var(--accent)">${ticketMedio !== null ? fmt(ticketMedio) : '—'}</div>
      <div class="card-sub">${unidadesMes} unidade${unidadesMes!==1?'s':''} vendida${unidadesMes!==1?'s':''}</div>
    </div>
    <div class="card">
      <div class="card-label">ROI — Período</div>
      <div class="card-value" style="color:${cmvMes>0?(lucroBruto/cmvMes*100)>=50?'var(--entrada)':(lucroBruto/cmvMes*100)>=20?'var(--warn)':'var(--saida)':'var(--text2)'}">${cmvMes > 0 ? (lucroBruto/cmvMes*100).toFixed(2)+'%' : '—'}</div>
      <div class="card-sub">Lucro ${fmt(lucroBruto)} ÷ CMV ${fmt(cmvMes)}</div>
    </div>
    <div class="card">
      <div class="card-label">CMV % — Período</div>
      <div class="card-value" style="color:${corCMV}">${fmtPct(cmvPct)}</div>
      <div class="card-sub">CMV: <span style="color:var(--saida)">${fmt(cmvMes)}</span></div>
    </div>`;

  // ── METAS ──
  const metas    = getMetas();
  const metaMes  = metas[mes] || {};
  const metaFat  = metaMes.faturamento || 0;
  const metaLuc  = metaMes.lucro || 0;
  const pctFat   = metaFat  > 0 ? Math.min(100, receitaMes / metaFat  * 100) : 0;
  const pctLuc   = metaLuc  > 0 ? Math.min(100, lucroBruto / metaLuc  * 100) : 0;
  const [y, mo]  = mes.split('-');
  const labelMes = new Date(y, mo-1).toLocaleString('pt-BR', {month:'long', year:'numeric'});

  const barMeta = (label, field, atual, meta, pct, cor) => `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px">
        <span style="font-size:12px;color:var(--text2)">${label}</span>
        <input type="number" value="${meta||''}" placeholder="Definir meta..." min="0" step="100"
          style="width:140px;text-align:right;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:4px 8px;font-size:12px;outline:none"
          onchange="saveMeta('${mes}','${field}',this.value)">
      </div>
      ${meta > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
          <span style="color:${atual>=0?'var(--entrada)':'var(--saida)'}">${fmt(atual)}</span>
          <span style="color:${pct>=100?'var(--entrada)':pct>=70?'var(--warn)':'var(--text2)'}">${pct.toFixed(0)}% da meta</span>
        </div>
        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${pct>=100?'var(--entrada)':pct>=70?'var(--warn)':cor};border-radius:4px;transition:width .4s"></div>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">
          Meta: ${fmt(meta)} ${pct>=100 ? '✅ Atingida!' : '· Faltam: '+fmt(meta-atual)}
        </div>` : `
        <div style="height:8px;background:var(--border);border-radius:4px"></div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">Defina uma meta para acompanhar</div>`}
    </div>`;

  metasEl.innerHTML = `
    <div class="form-panel" style="padding:16px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <h2 style="margin:0;font-size:13px">Metas — ${labelMes}</h2>
        <span style="font-size:11px;color:var(--text2)">Defina metas e acompanhe o progresso do mês</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px">
        ${barMeta('Meta de Faturamento', 'faturamento', receitaMes, metaFat, pctFat, 'var(--entrada)')}
        ${barMeta('Meta de Lucro Bruto', 'lucro', lucroBruto, metaLuc, pctLuc, 'var(--accent)')}
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// BALANÇO PATRIMONIAL
// ══════════════════════════════════════════════════════════════════════════════
function renderBalanco() {
  const anoEl = document.getElementById('bp-ano');
  if (!anoEl) return;
  const anos = [...new Set(lancamentos.map(l => l.data.slice(0,4)))].sort().reverse();
  if (!anos.includes(hoje().slice(0,4))) anos.unshift(hoje().slice(0,4));
  const vAtual = anoEl.value || hoje().slice(0,4);
  anoEl.innerHTML = anos.map(a => `<option${a===vAtual?' selected':''}>${a}</option>`).join('');
  const ano = anoEl.value || hoje().slice(0,4);

  const cmvCats = Object.keys(CATEGORIAS_CMV);

  // ── ATIVO ──
  // 1. Caixa = saldo DFC acumulado até o ano selecionado
  const lancAteAno = lancamentos.filter(l => l.data.slice(0,4) <= ano);
  const lancDFC = lancAteAno.filter(l =>
    !l.isCMV && !cmvCats.includes(l.categoria) && !(l.tipo==='Saída' && l.status==='Pendente')
  );
  const valDFC = l => l.tipo==='Entrada' ? (l.valorRecebido ?? l.valor) : l.valor;
  const entDFC  = lancDFC.filter(l=>l.tipo==='Entrada').reduce((a,l)=>a+valDFC(l),0);
  const saiDFC  = lancDFC.filter(l=>l.tipo==='Saída').reduce((a,l)=>a+l.valor,0);
  const caixa   = entDFC - saiDFC;

  // 2. Contas a Receber = parcelas pendentes em aberto (qualquer período)
  const aReceber = lancamentos.filter(l =>
    l.tipo==='Entrada' && l.valorRecebido !== undefined && l.valorRecebido !== null && l.valorRecebido < l.valor
  );
  const totalAReceber = aReceber.reduce((a,l) => a + (l.valor - l.valorRecebido), 0);

  // 3. Estoque estimado = total pago a Fornecedores (Estoque) - total CMV reconhecido
  const totalFornecPago = lancAteAno.filter(l =>
    l.tipo==='Saída' && l.categoria==='Fornecedores (Estoque)' && l.status==='Confirmado'
  ).reduce((a,l)=>a+l.valor,0);
  const totalCMVReconhecido = lancAteAno.filter(l =>
    l.isCMV || cmvCats.includes(l.categoria)
  ).reduce((a,l)=>a+l.valor,0);
  const estoque = Math.max(0, totalFornecPago - totalCMVReconhecido);

  const totalAtivo = Math.max(0, caixa) + totalAReceber + estoque;

  // ── PASSIVO ──
  const aPagar = lancamentos.filter(l =>
    l.tipo==='Saída' && l.status==='Pendente' && !l.isCMV && !cmvCats.includes(l.categoria)
  );
  const totalFornecPagar = aPagar.filter(l=>l.categoria==='Fornecedores (Estoque)').reduce((a,l)=>a+l.valor,0);
  const totalOutrasPagar = aPagar.filter(l=>l.categoria!=='Fornecedores (Estoque)').reduce((a,l)=>a+l.valor,0);
  const totalPassivo = totalFornecPagar + totalOutrasPagar;

  // ── PATRIMÔNIO LÍQUIDO ──
  const pl = totalAtivo - totalPassivo;
  const endividamento = totalAtivo > 0 ? (totalPassivo / totalAtivo * 100) : 0;

  // Cards
  document.getElementById('bp-cards').innerHTML = `
    <div class="card"><div class="card-label">Total Ativo</div><div class="card-value" style="color:var(--entrada)">${fmt(totalAtivo)}</div><div class="card-sub">Recursos totais</div></div>
    <div class="card"><div class="card-label">Total Passivo</div><div class="card-value" style="color:var(--saida)">${fmt(totalPassivo)}</div><div class="card-sub">Obrigações</div></div>
    <div class="card"><div class="card-label">Patrimônio Líquido</div><div class="card-value" style="color:${pl>=0?'var(--entrada)':'var(--saida)'}">${fmt(pl)}</div><div class="card-sub">Ativo − Passivo</div></div>
    <div class="card"><div class="card-label">Endividamento</div><div class="card-value" style="color:${endividamento<50?'var(--entrada)':endividamento<80?'var(--warn)':'var(--saida)'}">${endividamento.toFixed(2)}%</div><div class="card-sub">Passivo / Ativo</div></div>`;

  const linha = (label, val, indent=false, negStyle=false) => {
    const cor = val===0 ? 'color:var(--text2)' : negStyle ? 'color:var(--saida)' : val>0 ? 'color:var(--entrada)' : 'color:var(--saida)';
    return `<div class="rel-linha${indent?' indent':''}">
      <span>${label}</span>
      <span class="rel-valor" style="${cor};font-weight:600">${fmt(val)}</span>
    </div>`;
  };
  const linhaTotal = (label, val, final=false) =>
    `<div class="rel-linha ${final?'total-final':'total'}">
      <span>${label}</span>
      <span class="rel-valor ${val>=0?'pos':'neg'}">${fmt(val)}</span>
    </div>`;
  const grupo = label => `<div class="rel-grupo">${label}</div>`;

  document.getElementById('bp-corpo').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
      <div class="rel-panel">
        <div class="rel-titulo"><h3>ATIVO</h3><span>Acumulado ${ano}</span></div>
        ${grupo('Ativo Circulante')}
        ${linha('Caixa e Equivalentes de Caixa', Math.max(0, caixa), true)}
        ${linha('Contas a Receber', totalAReceber, true)}
        ${linha('Estoque Estimado', estoque, true)}
        <div class="rel-linha indent" style="font-size:11px;color:var(--text2);padding-top:0">
          Fornecedores pagos ${fmt(totalFornecPago)} − CMV reconhecido ${fmt(totalCMVReconhecido)}
        </div>
        ${caixa < 0 ? `<div class="rel-linha indent" style="font-size:11px;color:var(--warn)">⚠️ Saldo de caixa negativo: ${fmt(caixa)}</div>` : ''}
        ${linhaTotal('TOTAL ATIVO', totalAtivo, true)}
      </div>
      <div class="rel-panel">
        <div class="rel-titulo"><h3>PASSIVO + PL</h3><span>Acumulado ${ano}</span></div>
        ${grupo('Passivo Circulante')}
        ${linha('Fornecedores a Pagar', totalFornecPagar, true, true)}
        ${linha('Outras Contas a Pagar', totalOutrasPagar, true, true)}
        ${linhaTotal('TOTAL PASSIVO', totalPassivo)}
        ${grupo('Patrimônio Líquido')}
        ${linha('Resultado Acumulado', pl, true, pl < 0)}
        ${linhaTotal('TOTAL PASSIVO + PL', totalAtivo, true)}
      </div>
    </div>
    <div class="rel-panel" style="margin-top:0">
      <div class="rel-titulo"><h3>Composição do Ativo</h3></div>
      ${totalAtivo > 0 ? `
        <div style="padding:14px 20px;display:flex;flex-direction:column;gap:10px">
          ${[
            ['Caixa', Math.max(0,caixa), '#22c55e'],
            ['A Receber', totalAReceber, '#f59e0b'],
            ['Estoque', estoque, '#16a34a'],
          ].map(([label, val, cor]) => {
            const pct = totalAtivo > 0 ? (val/totalAtivo*100).toFixed(2) : 0;
            return `<div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:var(--text2)">${label}</span>
                <span style="font-weight:700">${fmt(val)} <span style="color:var(--text2);font-weight:400">(${pct}%)</span></span>
              </div>
              <div style="height:6px;background:var(--border);border-radius:3px">
                <div style="height:100%;width:${pct}%;background:${cor};border-radius:3px;transition:width .3s"></div>
              </div>
            </div>`;
          }).join('')}
        </div>` : '<div class="empty-state" style="padding:24px"><div>Nenhum dado para exibir</div></div>'}
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// RELATÓRIO MENSAL / ANUAL
// ══════════════════════════════════════════════════════════════════════════════

function renderRelatorio() {
  const relMesEl = document.getElementById('rel-mes');
  const relAnoEl = document.getElementById('rel-ano');
  if (!relMesEl || !relAnoEl) return;

  // Popular anos
  const anos = [...new Set(lancamentos.map(l => l.data.slice(0,4)))].sort().reverse();
  if (!anos.includes(hoje().slice(0,4))) anos.unshift(hoje().slice(0,4));
  const vAno = relAnoEl.value || hoje().slice(0,4);
  relAnoEl.innerHTML = anos.map(a => `<option${a===vAno?' selected':''}>${a}</option>`).join('');
  const ano = relAnoEl.value || hoje().slice(0,4);

  const mesVal    = relMesEl.value;
  const mesFiltro = mesVal !== '' ? parseInt(mesVal) : null;

  const MESES      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const cmvCats    = Object.keys(CATEGORIAS_CMV);
  // Categorias SG&A — espelha o DRE para cálculo de Lucro Líquido
  const SGA_CATS   = ['Deduções das Vendas','Custos Variáveis Indiretos','Despesas com Ocupação','Despesas com Pessoal','Despesas Variáveis','Softwares / Tecnologias','Serviços Terceirizados'];
  const NAOOP_CATS = ['Dívidas / Empréstimos','Saídas Não-Operacionais'];

  const lancAno  = lancamentos.filter(l => l.data.startsWith(ano));
  const filtrados = mesFiltro !== null
    ? lancAno.filter(l => parseInt(l.data.slice(5,7)) - 1 === mesFiltro)
    : lancAno;

  const labelPeriodo = mesFiltro !== null ? `${MESES_FULL[mesFiltro]}/${ano}` : ano;

  // Totais do período
  const { fat, cmvTotal, despTotal, lucroLiq: _lucroLiqRel, vendas, unidades, ticket } = calcularMetricasPeriodo(filtrados);
  const lucro  = fat - cmvTotal;
  const margem = fat > 0 ? (lucro / fat * 100) : null;

  // Dados mensais
  const mv = MESES.map((_, i) => {
    const pfx  = `${ano}-${String(i+1).padStart(2,'0')}`;
    const lm   = lancamentos.filter(l => l.data.startsWith(pfx));
    const f    = lm.filter(l => l.tipo==='Entrada' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
    const cmv  = lm.filter(l => l.isCMV || cmvCats.includes(l.categoria)).reduce((a,l) => a + l.valor, 0);
    const sga  = lm.filter(l => l.tipo==='Saída' && SGA_CATS.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
    const naoOp= lm.filter(l => l.tipo==='Saída' && NAOOP_CATS.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
    const luc  = f - cmv;
    const lucLiq = f - cmv - sga - naoOp;
    const vds  = lm.filter(l => l.tipo==='Entrada' && !l.isCMV);
    const uni  = vds.reduce((a,l) => a + (l.quantidade || 1), 0);
    const tkt  = vds.length > 0 ? f / uni : 0;
    const cmvP = f > 0 ? (cmv / f * 100) : 0;
    return { fat: f, cmv, lucro: luc, lucroLiq: lucLiq, ticket: tkt, cmvPct: cmvP };
  });

  // Gastos por categoria (período filtrado)
  const porCat = {};
  filtrados.filter(l => l.tipo==='Saída' && !l.isCMV && !cmvCats.includes(l.categoria))
    .forEach(l => { porCat[l.categoria] = (porCat[l.categoria] || 0) + l.valor; });

  const btnPDF = document.getElementById('btn-gerar-pdf');
  if (btnPDF) btnPDF.style.display = filtrados.length ? 'flex' : 'none';

  const textColor = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e2e8f0';
  const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1e293b';

  const CHART_H = '280px';
  const chartPanel = (id, titulo) =>
    `<div class="form-panel" style="padding:16px 20px">
       <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px">${titulo}</div>
       <div style="position:relative;height:${CHART_H}"><canvas id="${id}"></canvas></div>
     </div>`;

  const legend  = { labels: { color: textColor, font: { size: 11 }, boxWidth: 12 } };
  const axisX   = { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } };
  const axisY   = (cb) => ({ ticks: { color: textColor, font: { size: 11 }, callback: cb }, grid: { color: gridColor } });
  const baseOpts = (scales) => ({ responsive: true, maintainAspectRatio: false, plugins: { legend }, scales });
  const fmtBRL  = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const fmtPct  = v => v.toFixed(2) + '%';

  // ── VIEW: MÊS ESPECÍFICO ──
  if (mesFiltro !== null) {
    const i     = mesFiltro;
    const vm    = mv[i];
    const vendas = filtrados.filter(l => l.tipo==='Entrada' && !l.isCMV);
    const uni    = vendas.reduce((a,l) => a + (l.quantidade || 1), 0);
    const tkt    = uni > 0 ? fat / uni : null;
    // Lucro Líquido alinhado ao DRE
    const sgaMes   = filtrados.filter(l => l.tipo==='Saída' && SGA_CATS.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
    const naoOpMes = filtrados.filter(l => l.tipo==='Saída' && NAOOP_CATS.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
    const lucroLiq = fat - cmvTotal - sgaMes - naoOpMes;
    const caixaLiq = fat - cmvTotal - despTotal;

    // Acessórios
    const vendasAcess = filtrados.filter(l => l.tipo==='Entrada' && l.categoria==='Acessórios' && !l.isCMV);
    const fatAcess    = vendasAcess.reduce((a,l) => a + l.valor, 0);
    const cmvAcess    = vendasAcess.reduce((a,l) => { if (!l.grupoId) return a; const ce = lancamentos.find(x => x.grupoId===l.grupoId && x.isCMV); return a + (ce ? ce.valor : 0); }, 0);
    const uniAcess    = vendasAcess.reduce((a,l) => a + (l.quantidade || 1), 0);
    const lucroAcess  = fatAcess - cmvAcess;
    const lucroMedioAcess = uniAcess > 0 ? lucroAcess / uniAcess : null;

    // Aparelhos
    const vendasApar = filtrados.filter(l => l.tipo==='Entrada' && l.categoria==='Aparelhos' && !l.isCMV);
    const cmvApar    = vendasApar.reduce((a,l) => { if (!l.grupoId) return a; const ce = lancamentos.find(x => x.grupoId===l.grupoId && x.isCMV); return a + (ce ? ce.valor : 0); }, 0);
    const uniApar    = vendasApar.reduce((a,l) => a + (l.quantidade || 1), 0);
    const lucroApar  = vendasApar.reduce((a,l) => a + l.valor, 0) - cmvApar;
    const lucroMedioApar      = uniApar > 0 ? lucroApar / uniApar : 0;
    const lucroMedioAparAcess = (lucroMedioApar || 0) + (lucroMedioAcess || 0) || null;
    const uniAparAcess = uniApar + uniAcess;

    const gastoCac = filtrados.filter(l => l.tipo==='Saída' && l.status!=='Pendente' && (
      (l.categoria==='Softwares / Tecnologias'   && l.subcategoria==='CRM') ||
      (l.categoria==='Despesas Variáveis'         && l.subcategoria==='Mídia Paga') ||
      (l.categoria==='Custos Variáveis Indiretos' && l.subcategoria==='Comissões do Vendedor')
    )).reduce((a,l) => a + l.valor, 0);
    const cac    = uniApar > 0 ? gastoCac / uniApar : null;
    const cacSub = uniApar > 0 ? `${uniApar} aparelhos vendidos` : null;

    // Lucro acumulado com acessório (YTD até o mês selecionado)
    const lucAcessAcum = MESES.slice(0, i+1).reduce((acc, _, j) => {
      const pfx = `${ano}-${String(j+1).padStart(2,'0')}`;
      const lm  = lancamentos.filter(l => l.data.startsWith(pfx));
      const va  = lm.filter(l => l.tipo==='Entrada' && l.categoria==='Acessórios' && !l.isCMV);
      const fa  = va.reduce((a,l) => a + l.valor, 0);
      const ca  = va.reduce((a,l) => { if (!l.grupoId) return a; const ce = lancamentos.find(x => x.grupoId===l.grupoId && x.isCMV); return a + (ce ? ce.valor : 0); }, 0);
      return acc + fa - ca;
    }, 0);

    // Dados mensais para sparklines de acessório
    const mvAcess = MESES.map((_, j) => {
      const pfx = `${ano}-${String(j+1).padStart(2,'0')}`;
      const lm  = lancamentos.filter(l => l.data.startsWith(pfx));
      const va  = lm.filter(l => l.tipo==='Entrada' && l.categoria==='Acessórios' && !l.isCMV);
      const fa  = va.reduce((a,l) => a + l.valor, 0);
      const ca  = va.reduce((a,l) => { if (!l.grupoId) return a; const ce = lancamentos.find(x => x.grupoId===l.grupoId && x.isCMV); return a + (ce ? ce.valor : 0); }, 0);
      const ua  = va.reduce((a,l) => a + (l.quantidade || 1), 0);
      return { lucA: fa - ca, uniA: ua, lucMedA: ua > 0 ? (fa-ca)/ua : 0 };
    });
    let _acum = 0;
    const lucAcessAcumPorMes = mvAcess.map(v => { _acum += v.lucA; return _acum; });
    const cacPorMes = MESES.map((_, j) => {
      const pfx  = `${ano}-${String(j+1).padStart(2,'0')}`;
      const lm   = lancamentos.filter(l => l.data.startsWith(pfx));
      const desp = lm.filter(l => l.tipo==='Saída' && !l.isCMV && !cmvCats.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
      const gCac = lm.filter(l => l.tipo==='Saída' && l.status!=='Pendente' && (
        (l.categoria==='Softwares / Tecnologias'   && l.subcategoria==='CRM') ||
        (l.categoria==='Despesas Variáveis'         && l.subcategoria==='Mídia Paga') ||
        (l.categoria==='Custos Variáveis Indiretos' && l.subcategoria==='Comissões do Vendedor')
      )).reduce((a,l) => a + l.valor, 0);
      const uApar = lm.filter(l => l.tipo==='Entrada' && l.categoria==='Aparelhos' && !l.isCMV).reduce((a,l) => a + (l.quantidade||1), 0);
      return uApar > 0 ? gCac / uApar : 0;
    });

    const pts = (data, idx) => data.map((v, j) =>
      j === idx ? '#fff' : 'transparent'
    );
    const mkSparkData = (data) => ({
      labels: MESES,
      datasets: [{ data, borderColor: '#3b82f6', backgroundColor: '#3b82f622',
        borderWidth: 2, fill: true, tension: 0.3, pointRadius: 5,
        pointBackgroundColor: pts(data, i), pointBorderColor: pts(data, i).map(c => c==='#fff'?'#3b82f6':'transparent') }]
    });
    const sparkOpts = (cb) => ({
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false, ticks: { callback: cb } }
      }
    });

    const metrica = (id, label, valor, sub, dados, cb = fmtBRL, corValor = null) => {
      const cor = corValor || (typeof valor === 'number' && valor < 0 ? 'var(--saida)' : 'var(--entrada)');
      return `
        <div class="form-panel" style="display:flex;align-items:center;gap:0;padding:0;overflow:hidden">
          <div style="flex:1;padding:16px 20px;border-right:1px solid var(--border)">
            <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">${label}</div>
            <div style="position:relative;height:70px"><canvas id="${id}"></canvas></div>
          </div>
          <div style="min-width:160px;padding:16px 20px;text-align:right">
            <div style="font-size:11px;color:var(--text2);margin-bottom:4px">${MESES_FULL[i]}</div>
            <div style="font-size:20px;font-weight:800;color:${cor}">${valor === null ? '—' : (typeof valor === 'number' ? cb(valor) : valor)}</div>
            ${sub ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">${sub}</div>` : ''}
          </div>
        </div>`;
    };

    const gastPorMes = MESES.map((_,j) => { const pfx=`${ano}-${String(j+1).padStart(2,'0')}`; return lancamentos.filter(l=>l.data.startsWith(pfx)&&l.tipo==='Saída'&&!l.isCMV&&!cmvCats.includes(l.categoria)&&l.status!=='Pendente').reduce((a,l)=>a+l.valor,0); });
    const uniAparPorMes = MESES.map((_,j) => { const pfx=`${ano}-${String(j+1).padStart(2,'0')}`; return lancamentos.filter(l=>l.data.startsWith(pfx)&&l.tipo==='Entrada'&&l.categoria==='Aparelhos'&&!l.isCMV).reduce((a,l)=>a+(l.quantidade||1),0); });

    document.getElementById('rel-corpo').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;padding:16px">
        ${metrica('sp-fat',        'Faturamento',                       fat,                '',                    mv.map(v=>v.fat))}
        ${metrica('sp-uni',        'Qtd Aparelhos Vendidos',            uniApar,            '',                    uniAparPorMes,         v=>v.toLocaleString('pt-BR'), 'var(--text)')}
        ${metrica('sp-tkt',        'Ticket Médio',                      tkt,                uni+' unidades',       mv.map(v=>v.ticket))}
        ${metrica('sp-gast',       'Gastos Totais',                     despTotal,          '',                    gastPorMes,            fmtBRL, 'var(--saida)')}
        ${metrica('sp-lucliq',     'Lucro Líquido',                     lucroLiq,           '',                    mv.map(v=>v.lucroLiq), fmtBRL, lucroLiq>=0?'var(--entrada)':'var(--saida)')}
        ${metrica('sp-cac',        'CAC',                               cac,                cacSub,                cacPorMes)}
        ${metrica('sp-lucmed',     'Lucro Médio p/ Aparelho+Acessório', lucroMedioAparAcess, uniAparAcess+' unid.', mv.map(v=>v.ticket))}
        ${metrica('sp-acess-lmed', 'Lucro Médio p/ Acessório',         lucroMedioAcess,    uniAcess+' acessórios', mvAcess.map(v=>v.lucMedA))}
        ${metrica('sp-lucac',      'Lucro Acumulado c/ Acessório',      lucAcessAcum,       'YTD',                 lucAcessAcumPorMes)}
      </div>`;

    if (!window.Chart) return;
    const fmtInt = v => v.toLocaleString('pt-BR');
    const sparkIds  = ['sp-fat','sp-uni','sp-tkt','sp-gast','sp-lucliq','sp-cac','sp-lucmed','sp-acess-lmed','sp-lucac'];
    const sparkDados = [
      mv.map(v=>v.fat),
      uniAparPorMes,
      mv.map(v=>v.ticket),
      gastPorMes,
      mv.map(v=>v.lucroLiq),
      cacPorMes,
      mv.map(v=>v.ticket),
      mvAcess.map(v=>v.lucMedA),
      lucAcessAcumPorMes,
    ];
    const sparkFmt = [fmtBRL, fmtInt, fmtBRL, fmtBRL, fmtBRL, fmtBRL, fmtBRL, fmtBRL, fmtBRL];
    if (!window._sparks) window._sparks = {};
    sparkIds.forEach((id, k) => {
      if (window._sparks[id]) window._sparks[id].destroy();
      const el = document.getElementById(id);
      if (!el) return;
      const dados   = sparkDados[k];
      const fmt_cb  = sparkFmt[k];
      const bgColors = dados.map((_,j) => j===i ? '#3b82f6' : '#3b82f633');
      window._sparks[id] = new Chart(el, {
        type: 'bar',
        data: { labels: MESES, datasets: [{ data: dados, backgroundColor: bgColors, borderRadius: 3, borderSkipped: false }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: ctx => fmt_cb(ctx.raw) },
              backgroundColor: '#1e293b',
              titleColor: '#94a3b8',
              bodyColor: '#f1f5f9',
              bodyFont: { size: 12, weight: '700' },
              padding: 10,
              cornerRadius: 8,
              displayColors: false,
            }
          },
          scales: { x: { display: false }, y: { display: false } }
        }
      });
    });
    try { renderResumoExecutivo(); } catch(e) { console.error('renderResumoExecutivo:', e); }
    return;
  }

  // ── VIEW: ANO INTEIRO (4 gráficos) ──
  document.getElementById('rel-corpo').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px">
      ${chartPanel('chart-fat-lucro',  'Faturamento × Lucro')}
      ${chartPanel('chart-ticket',     'Ticket Médio por Mês')}
      ${chartPanel('chart-cmv-pct',    'CMV % sobre Receita')}
      ${chartPanel('chart-gastos-cat', 'Controle de Gastos')}
    </div>`;

  if (!window.Chart) return;

  // 1. Faturamento × Lucro
  if (window._cRelFL) window._cRelFL.destroy();
  window._cRelFL = new Chart(document.getElementById('chart-fat-lucro'), {
    data: {
      labels: MESES,
      datasets: [
        { type: 'bar', label: 'Faturamento', data: mv.map(v=>v.fat),   backgroundColor: '#22c55e44', borderColor: '#22c55e', borderWidth: 1, borderRadius: 4 },
        { type: 'bar', label: 'Lucro Bruto', data: mv.map(v=>v.lucro), backgroundColor: '#3b82f644', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4 },
      ]
    },
    options: baseOpts({ x: axisX, y: axisY(fmtBRL) })
  });

  // 2. Ticket Médio
  if (window._cRelTkt) window._cRelTkt.destroy();
  window._cRelTkt = new Chart(document.getElementById('chart-ticket'), {
    type: 'bar',
    data: {
      labels: MESES,
      datasets: [{ label: 'Ticket Médio', data: mv.map(v=>v.ticket), backgroundColor: '#f59e0b88', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 4 }]
    },
    options: baseOpts({ x: axisX, y: axisY(fmtBRL) })
  });

  // 3. CMV %
  if (window._cRelCMV) window._cRelCMV.destroy();
  window._cRelCMV = new Chart(document.getElementById('chart-cmv-pct'), {
    type: 'bar',
    data: {
      labels: MESES,
      datasets: [{ label: 'CMV %', data: mv.map(v=>v.cmvPct), backgroundColor: '#f03e3e88', borderColor: '#f03e3e', borderWidth: 1, borderRadius: 4 }]
    },
    options: baseOpts({ x: axisX, y: axisY(fmtPct) })
  });

  // 4. Controle de Gastos
  if (window._cRelGastos) window._cRelGastos.destroy();
  const catLabels = Object.keys(porCat).sort((a,b) => porCat[b]-porCat[a]).slice(0, 8);
  const catData   = catLabels.map(c => porCat[c]);
  const cores     = ['#f03e3e','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#84cc16','#fb923c'];
  window._cRelGastos = new Chart(document.getElementById('chart-gastos-cat'), {
    type: 'doughnut',
    data: {
      labels: catLabels.length ? catLabels : ['Sem dados'],
      datasets: [{ data: catLabels.length ? catData : [1], backgroundColor: catLabels.length ? cores.slice(0,catLabels.length) : ['#334155'], borderColor: 'transparent' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: c => c.label + ': ' + fmt(c.raw) } }
      }
    }
  });
  try { renderResumoExecutivo(); } catch(e) { console.error('renderResumoExecutivo:', e); }
}

// ══════════════════════════════════════════════════════════════════════════════
// RESUMO EXECUTIVO
// ══════════════════════════════════════════════════════════════════════════════
function renderResumoExecutivo() {
  const el = document.getElementById('rel-resumo');
  if (!el) return;

  const relMesEl = document.getElementById('rel-mes');
  const relAnoEl = document.getElementById('rel-ano');
  if (!relMesEl || !relAnoEl) return;

  if (relMesEl.value === '') { el.innerHTML = ''; return; }

  const ano       = relAnoEl.value || hoje().slice(0,4);
  const mesVal    = relMesEl.value;
  const mesFiltro = mesVal !== '' ? parseInt(mesVal) : null;

  const MESES      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const cmvCats    = Object.keys(CATEGORIAS_CMV);
  const SGA_CATS   = ['Deduções das Vendas','Custos Variáveis Indiretos','Despesas com Ocupação','Despesas com Pessoal','Despesas Variáveis','Softwares / Tecnologias','Serviços Terceirizados'];
  const NAOOP_CATS = ['Dívidas / Empréstimos','Saídas Não-Operacionais'];

  const lancAno  = lancamentos.filter(l => l.data.startsWith(ano));
  const filtrados = mesFiltro !== null
    ? lancAno.filter(l => parseInt(l.data.slice(5,7)) - 1 === mesFiltro)
    : lancAno;

  // ── Totais do período ──
  const { fat, cmvTotal, sgaMes, naoOpMes, lucroLiq, custosTotal } = calcularMetricasPeriodo(filtrados);
  const margem = fat > 0 ? (lucroLiq / fat * 100) : 0;

  // Fluxo de Caixa — mesma lógica do renderFluxo() (DFC)
  const lancDFCfilt = filtrados.filter(l => !l.isCMV && !cmvCats.includes(l.categoria) && !(l.tipo==='Saída' && l.status==='Pendente'));
  const valDFCf = l => l.tipo==='Entrada' ? (l.valorRecebido ?? l.valor) : l.valor;
  const entradas     = lancDFCfilt.filter(l => l.tipo==='Entrada').reduce((a,l) => a + valDFCf(l), 0);
  const saidas       = lancDFCfilt.filter(l => l.tipo==='Saída').reduce((a,l)   => a + valDFCf(l), 0);
  const geracaoCaixa = entradas - saidas;

  // ── Vendas por categoria ──
  const vendApar = filtrados.filter(l => l.tipo==='Entrada' && l.categoria==='Aparelhos' && !l.isCMV);
  const vendAces = filtrados.filter(l => l.tipo==='Entrada' && l.categoria==='Acessórios' && !l.isCMV);
  const vendAT   = filtrados.filter(l => l.tipo==='Entrada' && l.categoria==='Assistência Técnica' && !l.isCMV);
  const fatApar  = vendApar.reduce((a,l) => a + l.valor, 0);
  const fatAces  = vendAces.reduce((a,l) => a + l.valor, 0);
  const fatAT    = vendAT.reduce((a,l) => a + l.valor, 0);
  const uniApar  = vendApar.reduce((a,l) => a + (l.quantidade || 1), 0);
  const uniAces  = vendAces.reduce((a,l) => a + (l.quantidade || 1), 0);

  const cmvApar      = filtrados.filter(l => (l.isCMV || cmvCats.includes(l.categoria))).reduce((a,l) => a + l.valor, 0);
  const lucroMedApar = uniApar > 0 ? (fatApar - cmvApar) / uniApar : null;
  const tktApar      = uniApar > 0 ? fatApar / uniApar : null;
  const cmvAcesVal   = vendAces.reduce((a,l) => { if (!l.grupoId) return a; const ce = lancamentos.find(x => x.grupoId===l.grupoId && x.isCMV); return a + (ce ? ce.valor : 0); }, 0);
  const lucroMedAces = uniAces > 0 ? (fatAces - cmvAcesVal) / uniAces : null;
  const uniTotal     = uniApar + uniAces + vendAT.reduce((a,l) => a + (l.quantidade||1), 0);
  const ticketGeral  = uniTotal > 0 ? fat / uniTotal : null;
  const margemBruta  = fat > 0 ? (fat - cmvTotal) / fat * 100 : null;

  const pctApar  = fat > 0 ? (fatApar / fat * 100).toFixed(2) : '0.0';
  const pctAces  = fat > 0 ? (fatAces / fat * 100).toFixed(2) : '0.0';
  const pctAT    = fat > 0 ? (fatAT / fat * 100).toFixed(2) : '0.0';
  const pctOutros= fat > 0 ? (Math.max(0, fat - fatApar - fatAces - fatAT) / fat * 100).toFixed(2) : '0.0';

  // ── Mês anterior ──
  let prevFat = null, prevLucroLiq = null, prevMargem = null, prevCustos = null;
  if (mesFiltro !== null) {
    const prevM   = mesFiltro === 0 ? 11 : mesFiltro - 1;
    const prevAno = mesFiltro === 0 ? String(parseInt(ano) - 1) : ano;
    const pfxPrev = `${prevAno}-${String(prevM + 1).padStart(2,'0')}`;
    const lPrev   = lancamentos.filter(l => l.data.startsWith(pfxPrev));
    prevFat     = lPrev.filter(l => l.tipo==='Entrada' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
    const pCmv  = lPrev.filter(l => l.isCMV || cmvCats.includes(l.categoria)).reduce((a,l) => a + l.valor, 0);
    const pSga  = lPrev.filter(l => l.tipo==='Saída' && SGA_CATS.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
    const pNaoOp= lPrev.filter(l => l.tipo==='Saída' && NAOOP_CATS.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
    prevLucroLiq= prevFat - pCmv - pSga - pNaoOp;
    prevCustos  = pCmv + pSga + pNaoOp;
    prevMargem  = prevFat > 0 ? (prevLucroLiq / prevFat * 100) : 0;
  }

  const fatVar    = prevFat !== null && prevFat > 0 ? ((fat - prevFat) / prevFat * 100) : null;
  const fatVarAbs = prevFat !== null ? fat - prevFat : null;

  // ── NCG (Necessidade de Capital de Giro) ──
  const ncgReceber = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente').reduce((a,c) => a + c.valor, 0);
  const ncgPagar   = contas.filter(c => c.tipo === 'pagar'   && c.status === 'pendente').reduce((a,c) => a + c.valor, 0);
  const ncg        = ncgReceber - ncgPagar;

  // ── Nível de Saúde Financeira (score composto 0–100) ──
  const scoreML    = fat > 0 ? Math.max(0, Math.min(100, margem / 25 * 100)) : 0;                              // margem liq >= 25% → 100
  const scoreGC    = fat > 0 ? Math.max(0, Math.min(100, geracaoCaixa / fat / 0.20 * 100)) : 0;               // geração caixa >= 20% fat → 100
  const scoreCresc = fatVar !== null ? Math.max(0, Math.min(100, (fatVar + 20) / 40 * 100)) : 50;              // crescimento +20% → 100, -20% → 0
  const cmvPct     = fat > 0 ? cmvTotal / fat * 100 : 0;
  const scoreCMV   = fat > 0 ? Math.max(0, Math.min(100, (80 - cmvPct) / 50 * 100)) : 50;                     // CMV% <= 30% → 100, >= 80% → 0
  const healthScore = scoreML * 0.40 + scoreGC * 0.30 + scoreCresc * 0.20 + scoreCMV * 0.10;
  const healthLabel = healthScore >= 70 ? 'Saudável' : healthScore >= 40 ? 'Atenção' : 'Crítico';
  const healthColor = healthScore >= 70 ? '#22c55e' : healthScore >= 40 ? '#f59e0b' : '#f03e3e';

  // ── Dados mensais para gráfico ──
  const mvApar = MESES.map((_, j) => {
    const pfx = `${ano}-${String(j+1).padStart(2,'0')}`;
    return lancamentos.filter(l => l.data.startsWith(pfx) && l.tipo==='Entrada' && l.categoria==='Aparelhos' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
  });
  const mvAces = MESES.map((_, j) => {
    const pfx = `${ano}-${String(j+1).padStart(2,'0')}`;
    return lancamentos.filter(l => l.data.startsWith(pfx) && l.tipo==='Entrada' && l.categoria==='Acessórios' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
  });
  const mvLucro = MESES.map((_, j) => {
    const pfx = `${ano}-${String(j+1).padStart(2,'0')}`;
    const lj   = lancamentos.filter(l => l.data.startsWith(pfx));
    const fj   = lj.filter(l => l.tipo==='Entrada' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
    const cj   = lj.filter(l => l.isCMV || cmvCats.includes(l.categoria)).reduce((a,l) => a + l.valor, 0);
    const sj   = lj.filter(l => l.tipo==='Saída' && SGA_CATS.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
    const nj   = lj.filter(l => l.tipo==='Saída' && NAOOP_CATS.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
    return fj - cj - sj - nj;
  });

  // ── Helpers ──
  const pct   = v => v !== null ? v.toFixed(2) + '%' : '—';
  const vari  = (v, lbl) => {
    if (v === null) return '';
    const cor = v >= 0 ? 'var(--entrada)' : 'var(--saida)';
    return `<span style="color:${cor};font-size:12px;font-weight:600">${v >= 0 ? '+' : ''}${v.toFixed(2)}% vs ${lbl}</span>`;
  };
  const periodo   = mesFiltro !== null ? `${MESES_FULL[mesFiltro]} ${ano}` : `Ano ${ano}`;
  const prevLabel = mesFiltro !== null ? MESES_FULL[mesFiltro === 0 ? 11 : mesFiltro - 1] : '';
  const barPct    = v => `style="height:100%;width:${Math.min(100, parseFloat(v))}%;background:#22c55e;border-radius:3px"`;

  // ── HTML ──
  el.innerHTML = `
    <div style="padding:0 16px 16px;display:flex;flex-direction:column;gap:16px">

      <div class="form-panel" style="padding:20px 24px;border-left:4px solid #22c55e">
        <div style="font-size:11px;font-weight:700;color:#22c55e;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Resumo Executivo</div>
        <div style="font-size:20px;font-weight:800;color:var(--text)">${clienteAtivo?.nome || ''} — ${periodo}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <!-- VENDAS -->
        <div class="form-panel" style="padding:20px 24px">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px">Vendas</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
            <div style="background:var(--surface2);border-radius:10px;padding:12px 14px">
              <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Lucro Médio iPhone</div>
              <div style="font-size:18px;font-weight:800;color:var(--entrada)">${lucroMedApar !== null ? fmt(lucroMedApar) : '—'}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:4px">${uniApar} iPhone${uniApar !== 1 ? 's' : ''}</div>
            </div>
            <div style="background:var(--surface2);border-radius:10px;padding:12px 14px">
              <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Lucro Médio Acessório</div>
              <div style="font-size:18px;font-weight:800;color:var(--entrada)">${lucroMedAces !== null ? fmt(lucroMedAces) : '—'}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:4px">${uniAces} acessório${uniAces !== 1 ? 's' : ''}</div>
            </div>
            <div style="background:var(--surface2);border-radius:10px;padding:12px 14px">
              <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Ticket Médio</div>
              <div style="font-size:18px;font-weight:800;color:#8b5cf6">${ticketGeral !== null ? fmt(ticketGeral) : '—'}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:4px">Margem bruta: <strong style="color:${margemBruta !== null && margemBruta >= 0 ? 'var(--entrada)' : 'var(--saida)'}">${margemBruta !== null ? margemBruta.toFixed(2) + '%' : '—'}</strong></div>
            </div>
          </div>
          <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Vendas mensais — ${ano}</div>
          <div style="position:relative;height:180px"><canvas id="resumo-chart-vendas"></canvas></div>
        </div>

        <!-- RECEITA -->
        <div class="form-panel" style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Receita</div>

          <!-- Total + variação -->
          <div style="display:flex;align-items:flex-end;gap:16px">
            <div>
              <div style="font-size:30px;font-weight:800;color:var(--entrada)">${fmt(fat)}</div>
              ${fatVar !== null ? `<div style="font-size:12px;margin-top:2px">${vari(fatVar, prevLabel)} <span style="color:var(--text2)">(${fatVarAbs >= 0 ? '+' : ''}${fmt(fatVarAbs)})</span></div>` : ''}
            </div>
            ${fatVar !== null ? `
            <div style="margin-left:auto;text-align:center">
              <div style="position:relative;width:56px;height:56px"><canvas id="resumo-gauge-receita"></canvas></div>
              <div style="font-size:10px;color:var(--text2);margin-top:2px">${fatVar >= 0 ? 'Crescimento' : 'Decrescimento'}</div>
            </div>` : ''}
          </div>

          <!-- Diversificação -->
          <div style="display:flex;flex-direction:column;gap:6px">
            ${[['iPhone / Aparelhos', pctApar], ['Acessórios', pctAces], ['Assistência Técnica', pctAT], ['Outros', pctOutros]].map(([lbl, v]) => `
              <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;font-size:11px;color:var(--text2)">${lbl}</div>
                <div style="font-size:11px;font-weight:700;color:var(--text);min-width:32px;text-align:right">${v}%</div>
                <div style="width:80px;height:4px;border-radius:2px;background:var(--surface2);overflow:hidden;flex-shrink:0"><div ${barPct(v)}></div></div>
              </div>`).join('')}
          </div>

          <!-- Receita Mensal -->
          <div>
            <div style="font-size:10px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Receita Mensal — ${ano}</div>
            <div style="position:relative;height:90px"><canvas id="resumo-chart-receita-mensal"></canvas></div>
          </div>

          <!-- Comparativo Trimestral -->
          <div>
            <div style="font-size:10px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Comparativo Trimestral</div>
            <div style="position:relative;height:100px"><canvas id="resumo-chart-tri"></canvas></div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

        <!-- FLUXO DE CAIXA -->
        <div class="form-panel" style="padding:20px 24px">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px">Fluxo de Caixa</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px 16px;border:1px solid #22c55e44">
              <div style="font-size:11px;color:#22c55e;margin-bottom:4px">Entradas</div>
              <div style="font-size:17px;font-weight:800;color:#22c55e">${fmt(entradas)}</div>
            </div>
            <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px 16px;border:1px solid #f03e3e44">
              <div style="font-size:11px;color:var(--saida);margin-bottom:4px">Saídas</div>
              <div style="font-size:17px;font-weight:800;color:var(--saida)">${fmt(saidas)}</div>
            </div>
          </div>
          <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Geração de Caixa</div>
            <div style="font-size:20px;font-weight:800;color:${geracaoCaixa >= 0 ? 'var(--entrada)' : 'var(--saida)'}">${fmt(geracaoCaixa)}</div>
          </div>
          <div style="border:1px solid ${ncg <= 0 ? '#22c55e33' : '#f59e0b33'};border-radius:var(--radius-sm);padding:14px 16px;background:${ncg <= 0 ? '#22c55e08' : '#f59e0b08'}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <div>
                <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Necessidade de Capital de Giro</div>
                <div style="font-size:22px;font-weight:800;color:${ncg <= 0 ? 'var(--entrada)' : 'var(--warn)'}">${fmt(Math.abs(ncg))}</div>
              </div>
              ${ncg > 0 ? `<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:#f59e0b22;color:var(--warn)">Necessita de capital</span>` : ''}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div style="background:var(--surface2);border-radius:6px;padding:8px 12px">
                <div style="font-size:10px;color:var(--text2);margin-bottom:3px">A receber</div>
                <div style="font-size:14px;font-weight:700;color:var(--entrada)">${fmt(ncgReceber)}</div>
              </div>
              <div style="background:var(--surface2);border-radius:6px;padding:8px 12px">
                <div style="font-size:10px;color:var(--text2);margin-bottom:3px">A pagar</div>
                <div style="font-size:14px;font-weight:700;color:var(--saida)">${fmt(ncgPagar)}</div>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;margin-top:4px">
            <div style="position:relative;width:64px;height:64px;flex-shrink:0"><canvas id="resumo-gauge"></canvas></div>
            <div>
              <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Nível de Saúde Financeira</div>
              <div style="font-size:28px;font-weight:800;color:${healthColor}">${healthScore.toFixed(0)}/100</div>
              <div style="font-size:12px;font-weight:700;color:${healthColor};margin-top:2px">${healthLabel}</div>
            </div>
          </div>
        </div>

        <!-- LUCRO -->
        <div class="form-panel" style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Lucratividade</div>

          <!-- Lucro líquido destaque -->
          <div style="display:flex;align-items:flex-end;gap:16px">
            <div>
              <div style="font-size:30px;font-weight:800;color:${lucroLiq >= 0 ? 'var(--entrada)' : 'var(--saida)'}">${fmt(lucroLiq)}</div>
              ${prevLucroLiq !== null && prevLucroLiq !== 0 ? `<div style="font-size:12px;margin-top:2px">${vari((lucroLiq - prevLucroLiq) / Math.abs(prevLucroLiq) * 100, prevLabel)} <span style="color:var(--text2)">(${lucroLiq - prevLucroLiq >= 0 ? '+' : ''}${fmt(lucroLiq - prevLucroLiq)})</span></div>` : ''}
            </div>
            <div style="margin-left:auto;text-align:right">
              <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Margem Líquida</div>
              <div style="font-size:20px;font-weight:800;color:#f59e0b">${pct(margem)}</div>
              ${prevMargem !== null ? `<div style="font-size:11px;color:var(--text2)">${prevLabel}: ${pct(prevMargem)}</div>` : ''}
            </div>
          </div>

          <!-- Breakdown de custos -->
          <div style="display:flex;flex-direction:column;gap:6px">
            ${[['CMV', cmvTotal, '#f03e3e'], ['SGA', sgaMes, '#f59e0b'], ['Não-Operacional', naoOpMes, '#8b5cf6']].map(([lbl, val, cor]) => {
              const p = fat > 0 ? (val / fat * 100).toFixed(2) : '0.00';
              return `<div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;font-size:11px;color:var(--text2)">${lbl}</div>
                <div style="font-size:11px;font-weight:700;color:var(--text);min-width:60px;text-align:right">${fmt(val)}</div>
                <div style="font-size:11px;color:var(--text2);min-width:38px;text-align:right">${p}%</div>
                <div style="width:60px;height:4px;border-radius:2px;background:var(--surface2);overflow:hidden;flex-shrink:0"><div style="height:100%;width:${Math.min(100, parseFloat(p))}%;background:${cor};border-radius:3px"></div></div>
              </div>`;
            }).join('')}
          </div>

          <!-- Lucro mensal -->
          <div>
            <div style="font-size:10px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Lucro Mensal — ${ano}</div>
            <div style="position:relative;height:90px"><canvas id="resumo-chart-lucro"></canvas></div>
          </div>
        </div>

      </div>
    </div>`;

  if (!window.Chart) return;
  const textColor = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e2e8f0';
  const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim() || '#1e293b';

  // Gráfico de vendas mensais (Aparelhos vs Acessórios)
  if (window._resumoVendas) window._resumoVendas.destroy();
  const ctxV = document.getElementById('resumo-chart-vendas');
  if (ctxV) {
    const bgColors = MESES.map((_, j) => mesFiltro === j ? '#22c55e' : '#22c55e66');
    const bgAces   = MESES.map((_, j) => mesFiltro === j ? '#3b82f6' : '#3b82f666');
    window._resumoVendas = new Chart(ctxV, {
      type: 'bar',
      data: {
        labels: MESES,
        datasets: [
          { label: 'Aparelhos', data: mvApar, backgroundColor: bgColors, borderColor: 'transparent', borderWidth: 0 },
          { label: 'Acessórios', data: mvAces, backgroundColor: bgAces, borderColor: 'transparent', borderWidth: 0 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor, font: { size: 10 }, boxWidth: 10 } } },
        scales: {
          x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, font: { size: 10 }, callback: v => v.toLocaleString('pt-BR', {style:'currency',currency:'BRL'}) }, grid: { color: gridColor } }
        }
      }
    });
  }

  // Gauge de saúde financeira
  if (window._resumoGauge) window._resumoGauge.destroy();
  const ctxG = document.getElementById('resumo-gauge');
  if (ctxG) {
    window._resumoGauge = new Chart(ctxG, {
      type: 'doughnut',
      data: { datasets: [{ data: [healthScore, 100 - healthScore], backgroundColor: [healthColor, '#1e293b'], borderColor: 'transparent', borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
  }

  // Gauge de variação de receita
  if (window._resumoGaugeReceita) window._resumoGaugeReceita.destroy();
  const ctxGR = document.getElementById('resumo-gauge-receita');
  if (ctxGR && fatVar !== null) {
    const absVar = Math.min(100, Math.abs(fatVar));
    const corVar = fatVar >= 0 ? '#22c55e' : '#f03e3e';
    window._resumoGaugeReceita = new Chart(ctxGR, {
      type: 'doughnut',
      data: { datasets: [{ data: [absVar, 100 - absVar], backgroundColor: [corVar, '#1e293b'], borderColor: 'transparent', borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          afterDraw: undefined
        }
      }
    });
  }

  // Receita Mensal (barras verticais)
  if (window._resumoReceitaMensal) window._resumoReceitaMensal.destroy();
  const ctxRM = document.getElementById('resumo-chart-receita-mensal');
  if (ctxRM) {
    const mvFat = MESES.map((_, j) => {
      const pfx = `${ano}-${String(j+1).padStart(2,'0')}`;
      return lancamentos.filter(l => l.data.startsWith(pfx) && l.tipo==='Entrada' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
    });
    const bgFat = MESES.map((_, j) => mesFiltro === j ? '#22c55e' : '#22c55e44');
    window._resumoReceitaMensal = new Chart(ctxRM, {
      type: 'bar',
      data: { labels: MESES, datasets: [{ label: 'Faturamento Bruto', data: mvFat, backgroundColor: bgFat, borderRadius: 3, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => fmt(ctx.raw) }, backgroundColor: '#1e293b', bodyColor: '#f1f5f9', bodyFont: { size: 12, weight: '700' }, padding: 8, cornerRadius: 6, displayColors: false }
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 9 } }, grid: { display: false } },
          y: { display: false }
        }
      }
    });
  }

  // Comparativo Trimestral (barras horizontais)
  if (window._resumoTri) window._resumoTri.destroy();
  const ctxTri = document.getElementById('resumo-chart-tri');
  if (ctxTri) {
    const tris = ['1º TRI','2º TRI','3º TRI','4º TRI'];
    const coresTri = ['#22c55e','#3b82f6','#f59e0b','#8b5cf6'];
    const mesesPorTri = [[0,1,2],[3,4,5],[6,7,8],[9,10,11]];
    const datasets = mesesPorTri.map((idxs, t) => ({
      label: tris[t],
      data: idxs.map(j => {
        const pfx = `${ano}-${String(j+1).padStart(2,'0')}`;
        return lancamentos.filter(l => l.data.startsWith(pfx) && l.tipo==='Entrada' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
      }),
      backgroundColor: coresTri[t] + (mesFiltro !== null && mesesPorTri[t].includes(mesFiltro) ? 'cc' : '55'),
      borderColor: coresTri[t],
      borderWidth: 1,
      borderRadius: 3,
    }));
    window._resumoTri = new Chart(ctxTri, {
      type: 'bar',
      data: { labels: ['Mês 1','Mês 2','Mês 3'], datasets },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { size: 9 }, boxWidth: 8 }, position: 'bottom' },
          tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) }, backgroundColor: '#1e293b', bodyColor: '#f1f5f9', padding: 8, cornerRadius: 6 }
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 9 }, callback: v => v >= 1000 ? 'R$' + (v/1000).toFixed(0) + 'k' : fmt(v) }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, font: { size: 9 } }, grid: { display: false } }
        }
      }
    });
  }

  // Lucro Mensal
  if (window._resumoLucro) window._resumoLucro.destroy();
  const ctxLucro = document.getElementById('resumo-chart-lucro');
  if (ctxLucro) {
    const bgLucro = mvLucro.map((v, j) => {
      if (mesFiltro === j) return v >= 0 ? '#22c55e' : '#f03e3e';
      return v >= 0 ? '#22c55e44' : '#f03e3e44';
    });
    window._resumoLucro = new Chart(ctxLucro, {
      type: 'bar',
      data: { labels: MESES, datasets: [{ label: 'Lucro Líquido', data: mvLucro, backgroundColor: bgLucro, borderRadius: 3, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => fmt(ctx.raw) }, backgroundColor: '#1e293b', bodyColor: '#f1f5f9', bodyFont: { size: 12, weight: '700' }, padding: 8, cornerRadius: 6, displayColors: false }
        },
        scales: {
          x: { ticks: { color: textColor, font: { size: 9 } }, grid: { display: false } },
          y: { display: false }
        }
      }
    });
  }
}
