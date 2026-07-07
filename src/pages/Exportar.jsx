import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, hoje } from '../services/utils';
import { CMVCATS, DEDUCOES_CATS, SGA_CATS, NAOOP_CATS, APORTE_CATS } from '../services/constants';
import './Exportar.css';

function fmtBR(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function Exportar() {
  const { lancamentos, clienteAtivo } = useApp();

  const [dataInicio, setDataInicio] = useState(hoje().slice(0, 7) + '-01');
  const [dataFim,    setDataFim]    = useState(hoje());

  const filtrados = useMemo(() => {
    if (!dataInicio || !dataFim) return [];
    return lancamentos.filter(l => l.data >= dataInicio && l.data <= dataFim);
  }, [lancamentos, dataInicio, dataFim]);

  const totEntradas = filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const totSaidas   = filtrados.filter(l => l.tipo === 'Saída' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const saldo       = totEntradas - totSaidas;

  const metricas = useMemo(() => {
    const lm = filtrados;

    const fat       = lm.filter(l => l.tipo === 'Entrada' && !l.isCMV && !APORTE_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
    const cmv       = lm.filter(l => l.isCMV || CMVCATS.includes(l.categoria)).reduce((a, l) => a + l.valor, 0);
    const deducoes  = lm.filter(l => l.tipo === 'Saída' && DEDUCOES_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
    const sga       = lm.filter(l => l.tipo === 'Saída' && SGA_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
    const naoOp     = lm.filter(l => l.tipo === 'Saída' && NAOOP_CATS.includes(l.categoria) && l.status !== 'Pendente').reduce((a, l) => a + l.valor, 0);
    const lucroLiq  = fat - cmv - deducoes - sga - naoOp;
    const margem    = fat > 0 ? (lucroLiq / fat * 100) : 0;
    const custoTotal = cmv + deducoes + sga + naoOp;

    const aps       = lm.filter(l => l.tipo === 'Entrada' && l.categoria === 'Aparelhos' && !l.isCMV && l.status !== 'Pendente');
    const fatAp     = aps.reduce((a, l) => a + l.valor, 0);
    const uniAp     = aps.reduce((a, l) => a + (l.quantidade || 1), 0);
    const ticketAp  = uniAp > 0 ? fatAp / uniAp : 0;
    const apIds     = new Set(aps.filter(l => l.grupoId).map(l => l.grupoId));
    const cmvAp     = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId && apIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
    const lucroAp   = fatAp - cmvAp;
    const lucMedAp  = uniAp > 0 ? lucroAp / uniAp : 0;

    const accs      = lm.filter(l => l.tipo === 'Entrada' && l.categoria === 'Acessórios' && !l.isCMV && l.status !== 'Pendente');
    const fatAcc    = accs.reduce((a, l) => a + l.valor, 0);
    const uniAcc    = accs.reduce((a, l) => a + (l.quantidade || 1), 0);
    const accIds    = new Set(accs.filter(l => l.grupoId).map(l => l.grupoId));
    const cmvAcc    = lm.filter(l => (l.isCMV || CMVCATS.includes(l.categoria)) && l.grupoId && accIds.has(l.grupoId)).reduce((a, l) => a + l.valor, 0);
    const lucroAcc  = fatAcc - cmvAcc;

    const lmDFC     = lm.filter(l => !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente'));
    const entBruto  = lmDFC.filter(l => l.tipo === 'Entrada').reduce((a, l) => a + l.valor, 0);
    const dedInline = lmDFC.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null).reduce((a, l) => a + (l.valor - l.valorRecebido), 0);
    const upInline  = lmDFC.filter(l => l.tipo === 'Entrada' && l.valorUpgrade > 0).reduce((a, l) => a + l.valorUpgrade, 0);
    const entCaixa  = entBruto - upInline;
    const saiCaixa  = lmDFC.filter(l => l.tipo === 'Saída').reduce((a, l) => a + l.valor, 0) + dedInline;
    const geracaoCaixa = entCaixa - saiCaixa;

    return { fat, cmv, lucroLiq, margem, custoTotal, uniAp, fatAp, ticketAp, lucMedAp, lucroAp, uniAcc, fatAcc, lucroAcc, entCaixa, saiCaixa, geracaoCaixa };
  }, [filtrados]);

  function exportarCSV() {
    if (!filtrados.length) return;
    const nomeCliente = clienteAtivo?.nome?.replace(/\s+/g, '_') || 'cliente';
    const cols = ['ID', 'Data', 'Tipo', 'Categoria', 'Subcategoria', 'Descrição', 'Pagamento', 'Status', 'Valor (R$)', 'Observações'];
    const rows = filtrados.map(l => [
      '#' + String(l.id).padStart(3, '0'),
      l.data, l.tipo, l.categoria || '', l.subcategoria || '',
      l.descricao || '', l.pagamento || '', l.status || '',
      l.valor.toFixed(2).replace('.', ','), l.obs || '',
    ]);
    const csv  = [cols, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `relatorio_${nomeCliente}_${dataInicio}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function gerarRelatorioExec() {
    const m   = metricas;
    const cor = (v) => v >= 0 ? '#16a34a' : '#dc2626';
    const cliente = clienteAtivo?.obs || clienteAtivo?.nome || '';
    const periodo = `${fmtData(dataInicio)} — ${fmtData(dataFim)}`;

    const card = (label, value, color = '#111', sub = '') => `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:4px">
        <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.6px">${label}</div>
        <div style="font-size:22px;font-weight:900;color:${color};line-height:1.1">${value}</div>
        ${sub ? `<div style="font-size:11px;color:#9ca3af">${sub}</div>` : ''}
      </div>`;

    const section = (title, content) => `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e5e7eb">${title}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${content}</div>
      </div>`;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Relatório Executivo — ${cliente}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111;padding:28px 32px}
      @page{margin:12mm 14mm;size:A4 portrait}
      @media print{body{padding:0}}
    </style>
    </head><body>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #16a34a">
      <div>
        <div style="font-size:11px;font-weight:700;color:#16a34a;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px">Relatório Executivo</div>
        <div style="font-size:28px;font-weight:900;color:#111;letter-spacing:-0.5px">${cliente}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:1px">Período</div>
        <div style="font-size:13px;font-weight:700;color:#374151">${periodo}</div>
        <div style="font-size:10px;color:#d1d5db;margin-top:4px">Preparado por SOUZ Finance</div>
      </div>
    </div>

    ${section('Resultado Financeiro',
      card('Faturamento', fmtBR(m.fat), '#16a34a') +
      card('Custo Total', fmtBR(m.custoTotal), '#dc2626') +
      card('Lucro Líquido', fmtBR(m.lucroLiq), cor(m.lucroLiq)) +
      card('Margem', m.fat > 0 ? m.margem.toFixed(1) + '%' : '—', cor(m.margem))
    )}

    ${section('Aparelhos',
      card('Unidades Vendidas', m.uniAp > 0 ? m.uniAp : '—', '#111') +
      card('Faturamento', fmtBR(m.fatAp), '#2563eb') +
      card('Ticket Médio', m.uniAp > 0 ? fmtBR(m.ticketAp) : '—', '#111') +
      card('Lucro Médio / Un.', m.uniAp > 0 ? fmtBR(m.lucMedAp) : '—', cor(m.lucMedAp))
    )}

    ${section('Acessórios',
      card('Unidades Vendidas', m.uniAcc > 0 ? m.uniAcc : '—', '#111') +
      card('Faturamento', fmtBR(m.fatAcc), '#2563eb') +
      card('Lucro', fmtBR(m.lucroAcc), cor(m.lucroAcc)) +
      `<div></div>`
    )}

    ${section('Fluxo de Caixa',
      card('Entradas', fmtBR(m.entCaixa), '#16a34a') +
      card('Saídas', fmtBR(m.saiCaixa), '#dc2626') +
      card('Geração de Caixa', fmtBR(m.geracaoCaixa), cor(m.geracaoCaixa)) +
      `<div></div>`
    )}

    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  }

  const periodoValido = dataInicio && dataFim && dataInicio <= dataFim;
  const temDados = periodoValido && metricas.fat > 0;

  return (
    <div className="exportar-page">
      <div className="exportar-panel">
        <h2 className="exportar-titulo">Exportar Relatório</h2>
        <p className="exportar-sub">Escolha o período e baixe os lançamentos em CSV ou gere o relatório executivo em PDF.</p>

        <div className="exportar-filtros">
          <div className="exportar-field">
            <label>Data Início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div className="exportar-field">
            <label>Data Fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
        </div>

        {!periodoValido && dataInicio && dataFim && (
          <p className="exportar-erro">A data início deve ser anterior ou igual à data fim.</p>
        )}

        {periodoValido && (
          <div className="exportar-resumo">
            <div className="resumo-item">
              <span className="resumo-label">Lançamentos</span>
              <span className="resumo-valor">{filtrados.length}</span>
            </div>
            <div className="resumo-item">
              <span className="resumo-label">Entradas</span>
              <span className="resumo-valor entrada">{fmt(totEntradas)}</span>
            </div>
            <div className="resumo-item">
              <span className="resumo-label">Saídas</span>
              <span className="resumo-valor saida">{fmt(totSaidas)}</span>
            </div>
            <div className="resumo-item">
              <span className="resumo-label">Saldo</span>
              <span className={`resumo-valor ${saldo >= 0 ? 'entrada' : 'saida'}`}>{fmt(saldo)}</span>
            </div>
          </div>
        )}

        <div className="exportar-acoes">
          <button className="btn btn-ghost" onClick={exportarCSV} disabled={!periodoValido || filtrados.length === 0}>
            Baixar CSV
          </button>
          <button className="btn btn-primary" onClick={gerarRelatorioExec} disabled={!temDados}>
            ⬇ Relatório Executivo PDF
          </button>
        </div>

        {periodoValido && filtrados.length === 0 && (
          <p className="exportar-vazio">Nenhum lançamento encontrado nesse período.</p>
        )}
      </div>
    </div>
  );
}