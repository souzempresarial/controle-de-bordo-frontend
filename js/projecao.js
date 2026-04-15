// ══════════════════════════════════════════════════════════════════════════════
// PROJEÇÃO FINANCEIRA
// ══════════════════════════════════════════════════════════════════════════════

function getMetaProj(ano, mes, field) {
  const key = `fin_${clienteAtivo.id}_metaproj_${ano}_${mes}`;
  const m   = JSON.parse(localStorage.getItem(key) || '{}');
  return m[field] || 0;
}

function saveMetaProj(ano, mes, field, valor) {
  const key = `fin_${clienteAtivo.id}_metaproj_${ano}_${mes}`;
  const m   = JSON.parse(localStorage.getItem(key) || '{}');
  m[field]  = parseFloat(valor) || 0;
  localStorage.setItem(key, JSON.stringify(m));
  renderProjecaoBar();
  renderProjecao();
}

// ── Cálculos base ──────────────────────────────────────────────────────────
function calcProjecao(ano, mes) {
  const cmvCats  = Object.keys(CATEGORIAS_CMV);
  const SGA_CATS = ['Deduções das Vendas','Custos Variáveis Indiretos','Despesas com Ocupação','Despesas com Pessoal','Despesas Variáveis','Softwares / Tecnologias','Serviços Terceirizados'];
  const NAOOP    = ['Dívidas / Empréstimos','Saídas Não-Operacionais'];

  const pfx  = `${ano}-${mes}`;
  const lm   = lancamentos.filter(l => l.data.startsWith(pfx));

  const fat    = lm.filter(l => l.tipo==='Entrada' && !l.isCMV).reduce((a,l) => a + l.valor, 0);
  const cmv    = lm.filter(l => l.isCMV || cmvCats.includes(l.categoria)).reduce((a,l) => a + l.valor, 0);
  const sga    = lm.filter(l => l.tipo==='Saída' && SGA_CATS.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
  const naoOp  = lm.filter(l => l.tipo==='Saída' && NAOOP.includes(l.categoria) && l.status!=='Pendente').reduce((a,l) => a + l.valor, 0);
  const lucroLiq = fat - cmv - sga - naoOp;
  const vendas   = lm.filter(l => l.tipo==='Entrada' && !l.isCMV);
  const uni      = vendas.reduce((a,l) => a + (l.quantidade || 1), 0);
  const ticket   = uni > 0 ? fat / uni : 0;

  // Dias passados até hoje (dentro do mês)
  const hoje     = new Date();
  const anoN = parseInt(ano), mesN = parseInt(mes);
  const diasNoMes   = new Date(anoN, mesN, 0).getDate();
  const diaAtual    = (hoje.getFullYear() === anoN && hoje.getMonth() + 1 === mesN)
    ? hoje.getDate()
    : diasNoMes;
  const diasPassados = Math.max(1, diaAtual);
  const diasRestantes = diasNoMes - diasPassados;

  const ritmo = diasPassados > 0 ? fat / diasPassados : 0;
  const projFat    = fat + ritmo * diasRestantes;
  const projUni    = uni > 0 ? Math.round(uni / diasPassados * diasNoMes) : 0;
  const projLucro  = projFat > 0 && fat > 0 ? projFat * (lucroLiq / fat) : 0;
  const projTicket = projUni > 0 ? projFat / projUni : ticket;

  return { fat, cmv, sga, naoOp, lucroLiq, uni, ticket,
           diasNoMes, diasPassados, diasRestantes,
           projFat, projUni, projLucro, projTicket };
}

// ── Barra de projeção no Início ────────────────────────────────────────────
function renderProjecaoBar() {
  const el = document.getElementById('proj-bar-inicio');
  if (!el || !clienteAtivo) return;

  const mes  = document.getElementById('dash-mes')?.value || hoje().slice(5,7);
  const ano  = document.getElementById('dash-ano')?.value  || hoje().slice(0,4);
  const p    = calcProjecao(ano, mes);
  const meta = getMetaProj(ano, mes, 'fat');

  if (!meta && !p.fat) { el.innerHTML = ''; return; }

  const metaRef   = meta || p.projFat;
  const pctAtual  = Math.min(100, metaRef > 0 ? (p.fat / metaRef * 100) : 0);
  const pctProj   = Math.min(100, metaRef > 0 ? (p.projFat / metaRef * 100) : 0);
  const cor       = p.projFat >= metaRef ? '#22c55e' : p.projFat >= metaRef * 0.8 ? '#f59e0b' : '#f03e3e';
  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const nomeMes   = MESES_FULL[parseInt(mes) - 1];

  el.innerHTML = `
    <div class="form-panel" style="padding:16px 20px;margin-bottom:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Meta de Faturamento — ${nomeMes}</div>
        <div style="display:flex;align-items:center;gap:8px">
          ${meta ? `<span style="font-size:11px;color:var(--text2)">Meta: <strong style="color:var(--text)">${fmt(meta)}</strong></span>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="abrirModalMetaProj('${ano}','${mes}')">✏️ Definir meta</button>
        </div>
      </div>
      <div style="position:relative;height:18px;background:var(--surface2);border-radius:9px;overflow:hidden;margin-bottom:10px">
        <!-- Projeção (fundo mais claro) -->
        <div style="position:absolute;left:0;top:0;height:100%;width:${pctProj}%;background:${cor}44;border-radius:9px;transition:width .4s"></div>
        <!-- Atual (sólido) -->
        <div style="position:absolute;left:0;top:0;height:100%;width:${pctAtual}%;background:${cor};border-radius:9px;transition:width .4s"></div>
        <!-- Linha da meta -->
        ${meta ? `<div style="position:absolute;left:calc(100% - 2px);top:0;width:2px;height:100%;background:var(--text);opacity:.5"></div>` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px">
        <span style="color:${cor};font-weight:700">${fmt(p.fat)} <span style="font-weight:400;color:var(--text2)">(${pctAtual.toFixed(0)}% realizado)</span></span>
        <span style="color:var(--text2)">Projeção: <strong style="color:${cor}">${fmt(p.projFat)}</strong></span>
        <span style="color:var(--text2)">${p.diasRestantes} dias restantes</span>
      </div>
    </div>`;
}

function abrirModalMetaProj(ano, mes) {
  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const meta = getMetaProj(ano, mes, 'fat');
  const v    = prompt(`Meta de faturamento para ${MESES_FULL[parseInt(mes)-1]}/${ano}:`, meta || '');
  if (v === null) return;
  saveMetaProj(ano, mes, 'fat', v);
}

// ── Aba Projeção completa ──────────────────────────────────────────────────
function renderProjecao() {
  const el = document.getElementById('proj-corpo');
  if (!el || !clienteAtivo) return;

  const ano  = document.getElementById('fluxo-ano')?.value  || hoje().slice(0,4);
  const mesN = parseInt(hoje().slice(5,7));
  const mes  = String(mesN).padStart(2,'0');
  const p    = calcProjecao(ano, mes);

  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const nomeMes    = MESES_FULL[mesN - 1];

  const metaFat    = getMetaProj(ano, mes, 'fat');
  const metaLucro  = getMetaProj(ano, mes, 'lucro');
  const metaUni    = getMetaProj(ano, mes, 'uni');
  const metaTicket = getMetaProj(ano, mes, 'ticket');

  const bar = (atual, projecao, meta, cor) => {
    const ref  = meta || projecao || 1;
    const pAt  = Math.min(100, atual / ref * 100);
    const pPr  = Math.min(100, projecao / ref * 100);
    return `
      <div style="position:relative;height:14px;background:var(--surface2);border-radius:7px;overflow:hidden;margin:8px 0 4px">
        <div style="position:absolute;left:0;top:0;height:100%;width:${pPr}%;background:${cor}44;border-radius:7px"></div>
        <div style="position:absolute;left:0;top:0;height:100%;width:${pAt}%;background:${cor};border-radius:7px"></div>
        ${meta ? `<div style="position:absolute;right:0;top:0;width:2px;height:100%;background:var(--text);opacity:.4"></div>` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2)">
        <span>Atual: <strong style="color:${cor}">${typeof atual === 'number' && atual % 1 !== 0 || atual > 999 ? fmt(atual) : atual}</strong></span>
        <span>Projeção: <strong style="color:${cor}">${typeof projecao === 'number' && projecao > 999 ? fmt(projecao) : Math.round(projecao)}</strong></span>
        ${meta ? `<span>Meta: <strong style="color:var(--text)">${meta > 999 ? fmt(meta) : meta}</strong></span>` : ''}
      </div>`;
  };

  const metricCard = (titulo, atual, projecao, meta, cor, field) => `
    <div class="form-panel" style="padding:16px 20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">${titulo}</div>
        <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="editarMetaProjCampo('${ano}','${mes}','${field}','${titulo}')">✏️</button>
      </div>
      <div style="font-size:26px;font-weight:800;color:${cor}">${atual > 999 ? fmt(atual) : atual}</div>
      ${bar(atual, projecao, meta, cor)}
    </div>`;

  const cor = p.projFat >= (metaFat || p.projFat) ? '#22c55e' : p.projFat >= (metaFat || p.projFat) * 0.8 ? '#f59e0b' : '#f03e3e';

  el.innerHTML = `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <div class="form-panel" style="padding:16px 20px;border-left:4px solid ${cor}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Projeção de Fechamento</div>
            <div style="font-size:18px;font-weight:800;color:var(--text)">${nomeMes} ${ano}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text2)">${p.diasPassados} dias passados · ${p.diasRestantes} restantes</div>
            <div style="font-size:13px;font-weight:700;color:${cor}">Ritmo: ${fmt(p.fat / p.diasPassados)}/dia</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${metricCard('Faturamento',      p.fat,     p.projFat,    metaFat,    '#22c55e', 'fat')}
        ${metricCard('Lucro Líquido',    p.lucroLiq, p.projLucro, metaLucro,  p.lucroLiq >= 0 ? '#3b82f6' : '#f03e3e', 'lucro')}
        ${metricCard('Aparelhos Vendidos', p.uni,   p.projUni,    metaUni,    '#f59e0b', 'uni')}
        ${metricCard('Ticket Médio',     p.ticket,  p.projTicket, metaTicket, '#8b5cf6', 'ticket')}
      </div>
    </div>`;
}

function editarMetaProjCampo(ano, mes, field, titulo) {
  const atual = getMetaProj(ano, mes, field);
  const v = prompt(`Meta — ${titulo}:`, atual || '');
  if (v === null) return;
  saveMetaProj(ano, mes, field, v);
}
