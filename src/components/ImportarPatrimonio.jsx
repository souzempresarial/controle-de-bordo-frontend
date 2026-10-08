import { useState, useEffect, useMemo } from 'react';
import { API } from '../services/api';
import { fmt, MESES_FULL } from '../services/utils';
import './ImportarPatrimonio.css';

const DESTINOS = [
  { id: 'aparelhos',  label: 'Estoque Aparelhos' },
  { id: 'acessorios', label: 'Estoque Acessórios' },
  { id: 'manutencao', label: 'Em Manutenção' },
];
const FILTROS = [
  { id: 'todos',     label: 'Todos' },
  { id: 'aparelho',  label: 'Aparelhos' },
  { id: 'acessorio', label: 'Acessórios' },
  { id: 'peca',      label: 'Peças e serviços' },
  { id: 'alerta',    label: 'Com alerta' },
];

// Revisão item a item do estoque do Mercado Phone antes de entrar no Balanço
export default function ImportarPatrimonio({ clienteId, periodo, onFechar, onSalvo }) {
  const [itens, setItens]       = useState(null);
  const [erro, setErro]         = useState('');
  const [filtro, setFiltro]     = useState('todos');
  const [busca, setBusca]       = useState('');
  const [salvando, setSalvando] = useState(false);

  const [ano, mes] = periodo.split('-');
  const nomeMes = `${MESES_FULL[parseInt(mes) - 1]}/${ano}`;

  useEffect(() => {
    API.patrimonioPreview(clienteId)
      .then(r => setItens(r.itens.map((i, idx) => ({ ...i, _k: idx }))))
      .catch(e => setErro(e.message));
  }, [clienteId]);

  const visiveis = useMemo(() => {
    if (!itens) return [];
    const b = busca.trim().toLowerCase();
    return itens.filter(i =>
      (filtro === 'todos' || (filtro === 'alerta' ? i.alertas.length > 0 : i.tipo === filtro)) &&
      (!b || i.descricao.toLowerCase().includes(b) || (i.imei || '').includes(b))
    );
  }, [itens, filtro, busca]);

  const aprovados = (itens || []).filter(i => i.aprovado && i.quantidade > 0);
  const totalPor = d => aprovados.filter(i => i.destino === d).reduce((s, i) => s + i.quantidade * i.custo, 0);
  const totalGeral = aprovados.reduce((s, i) => s + i.quantidade * i.custo, 0);

  function mudar(k, campo, valor) {
    setItens(prev => prev.map(i => (i._k === k ? { ...i, [campo]: valor } : i)));
  }
  function marcarVisiveis(valor) {
    const ks = new Set(visiveis.map(i => i._k));
    setItens(prev => prev.map(i => (ks.has(i._k) ? { ...i, aprovado: valor } : i)));
  }

  async function salvar() {
    setSalvando(true); setErro('');
    try {
      const r = await API.patrimonioSalvar(clienteId, {
        mesChave: periodo,
        itens: aprovados.map(({ _k, alertas, aprovado, loja, ...resto }) => resto),
      });
      onSalvo(r.capital, r.itens);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !salvando && onFechar()}>
      <div className="modal-box imp-modal" role="dialog" aria-labelledby="imp-titulo">
        <div className="modal-header">
          <h3 id="imp-titulo">Importar Patrimônio — {nomeMes}</h3>
          <button className="modal-close" onClick={onFechar} disabled={salvando} aria-label="Fechar">✕</button>
        </div>

        <div className="modal-body imp-corpo">
          <div className="imp-aviso" role="note">
            <strong>A API do Mercado Phone pode conter erros.</strong> Ela costuma trazer duplicatas, aparelhos vendidos sem baixa e quantidades erradas.
            Revise item a item: só o que estiver marcado entra no Balanço de {nomeMes}. Itens com problema já vêm desmarcados.
          </div>

          {!itens && !erro && <div className="imp-carregando">Lendo o estoque do Mercado Phone…</div>}
          {erro && <div className="imp-erro" role="alert">{erro}</div>}

          {itens && (
            <>
              <div className="imp-resumo">
                {DESTINOS.map(d => (
                  <div key={d.id}><span>{d.label}</span><strong>{fmt(totalPor(d.id))}</strong></div>
                ))}
                <div className="imp-resumo-total"><span>Total aprovado · {aprovados.length} itens</span><strong>{fmt(totalGeral)}</strong></div>
              </div>

              <div className="imp-controles">
                <div className="imp-filtros" role="tablist">
                  {FILTROS.map(f => {
                    const n = f.id === 'todos' ? itens.length : f.id === 'alerta' ? itens.filter(i => i.alertas.length).length : itens.filter(i => i.tipo === f.id).length;
                    return (
                      <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id}
                        className={filtro === f.id ? 'ativo' : ''} onClick={() => setFiltro(f.id)}>
                        {f.label} <span>{n}</span>
                      </button>
                    );
                  })}
                </div>
                <input id="imp-busca" type="search" placeholder="Buscar produto ou IMEI" value={busca} onChange={e => setBusca(e.target.value)} />
                <div className="imp-massa">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => marcarVisiveis(true)}>Marcar visíveis</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => marcarVisiveis(false)}>Desmarcar visíveis</button>
                </div>
              </div>

              <div className="imp-tabela-wrap">
                <table className="imp-tabela">
                  <thead>
                    <tr>
                      <th aria-label="Aprovar"></th>
                      <th>Produto</th>
                      <th>Situação no MP</th>
                      <th className="num">Qtd</th>
                      <th className="num">Custo unit.</th>
                      <th className="num">Total</th>
                      <th>Entra em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map(i => (
                      <tr key={i._k} className={`${i.aprovado ? '' : 'imp-off'} ${i.alertas.length ? 'imp-com-alerta' : ''}`}>
                        <td>
                          <input type="checkbox" checked={i.aprovado} onChange={e => mudar(i._k, 'aprovado', e.target.checked)}
                            aria-label={`Aprovar ${i.descricao}`} />
                        </td>
                        <td className="imp-produto">
                          <div>{i.descricao}</div>
                          <div className="imp-meta">
                            {i.tipo === 'aparelho' ? 'Aparelho' : i.tipo === 'peca' ? 'Peça/serviço' : 'Acessório'}
                            {i.imei && <> · IMEI {i.imei}</>}
                            {i.dataEntrada && <> · entrada {i.dataEntrada.split('-').reverse().join('/')}</>}
                          </div>
                          {i.alertas.length > 0 && (
                            <div className="imp-alertas">{i.alertas.map(a => <span key={a}>⚠ {a}</span>)}</div>
                          )}
                        </td>
                        <td className="imp-sit">{i.disponibilidade || '—'}</td>
                        <td className="num">
                          <input type="number" min="0" step="1" value={i.quantidade}
                            onChange={e => mudar(i._k, 'quantidade', Math.max(0, parseInt(e.target.value) || 0))}
                            aria-label={`Quantidade de ${i.descricao}`} />
                        </td>
                        <td className="num">
                          <input type="number" min="0" step="0.01" value={i.custo}
                            onChange={e => mudar(i._k, 'custo', Math.max(0, parseFloat(e.target.value) || 0))}
                            aria-label={`Custo de ${i.descricao}`} />
                        </td>
                        <td className="num imp-total">{fmt(i.quantidade * i.custo)}</td>
                        <td>
                          <select value={i.destino} onChange={e => mudar(i._k, 'destino', e.target.value)} aria-label={`Destino de ${i.descricao}`}>
                            {DESTINOS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {visiveis.length === 0 && (
                      <tr><td colSpan={7} className="imp-vazio">Nenhum item neste filtro.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={!itens || !aprovados.length || salvando}>
            {salvando ? 'Salvando…' : `Salvar ${aprovados.length} itens no Balanço (${fmt(totalGeral)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
