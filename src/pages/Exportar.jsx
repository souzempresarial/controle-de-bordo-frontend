import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import './Exportar.css';

const fmt    = (v) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje   = () => new Date().toISOString().slice(0, 10);

export default function Exportar() {
  const { lancamentos, clienteAtivo } = useApp();

  const [dataInicio, setDataInicio] = useState(hoje().slice(0, 7) + '-01');
  const [dataFim,    setDataFim]    = useState(hoje());

  const filtrados = useMemo(() => {
    if (!dataInicio || !dataFim) return [];
    return lancamentos.filter(l => l.data >= dataInicio && l.data <= dataFim);
  }, [lancamentos, dataInicio, dataFim]);

  const totEntradas = filtrados.filter(l => l.tipo === 'Entrada' && !l.isCMV).reduce((a, l) => a + l.valor, 0);
  const totSaidas   = filtrados.filter(l => l.tipo === 'Saída').reduce((a, l) => a + l.valor, 0);
  const saldo       = totEntradas - totSaidas;

  function exportarCSV() {
    if (!filtrados.length) return;

    const nomeCliente = clienteAtivo?.nome?.replace(/\s+/g, '_') || 'cliente';
    const cols = ['ID', 'Data', 'Tipo', 'Categoria', 'Subcategoria', 'Descrição', 'Pagamento', 'Status', 'Valor (R$)', 'Observações'];
    const rows = filtrados.map(l => [
      '#' + String(l.id).padStart(3, '0'),
      l.data,
      l.tipo,
      l.categoria || '',
      l.subcategoria || '',
      l.descricao || '',
      l.pagamento || '',
      l.status || '',
      l.valor.toFixed(2).replace('.', ','),
      l.obs || '',
    ]);

    const csv  = [cols, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `relatorio_${nomeCliente}_${dataInicio}_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function imprimirPDF() {
    window.print();
  }

  const periodoValido = dataInicio && dataFim && dataInicio <= dataFim;

  return (
    <div className="exportar-page">
      <div className="exportar-panel">
        <h2 className="exportar-titulo">Exportar Relatório</h2>
        <p className="exportar-sub">Escolha o período e baixe os lançamentos em CSV ou imprima em PDF.</p>

        <div className="exportar-filtros">
          <div className="exportar-field">
            <label>Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
            />
          </div>
          <div className="exportar-field">
            <label>Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
            />
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
          <button
            className="btn btn-primary"
            onClick={exportarCSV}
            disabled={!periodoValido || filtrados.length === 0}
          >
            Baixar CSV
          </button>
          <button
            className="btn btn-ghost"
            onClick={imprimirPDF}
            disabled={!periodoValido || filtrados.length === 0}
          >
            Imprimir / PDF
          </button>
        </div>

        {periodoValido && filtrados.length === 0 && (
          <p className="exportar-vazio">Nenhum lançamento encontrado nesse período.</p>
        )}
      </div>

      {/* Prévia da tabela — só aparece na impressão */}
      {periodoValido && filtrados.length > 0 && (
        <div className="exportar-preview print-only">
          <h3>Relatório — {clienteAtivo?.nome} — {dataInicio} a {dataFim}</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Data</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(l => (
                <tr key={l.id}>
                  <td>#{String(l.id).padStart(3, '0')}</td>
                  <td>{l.data}</td>
                  <td>{l.tipo}</td>
                  <td>{l.categoria || '—'}</td>
                  <td>{l.descricao || '—'}</td>
                  <td>{l.status || '—'}</td>
                  <td style={{ textAlign: 'right', color: l.tipo === 'Entrada' ? 'green' : 'red' }}>
                    {fmt(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} style={{ fontWeight: 700 }}>Saldo do período</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(saldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
