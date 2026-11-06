import { useState, useEffect, useMemo } from 'react';
import { API } from '../services/api';
import { fmt, MESES, MESES_FULL, hoje } from '../services/utils';
import { resultadoCaixa, caixaNoDia1 } from '../services/caixa';
import './SaldoContas.css';

const TIPOS = [['banco', 'Banco'], ['maquininha', 'Maquininha'], ['especie', 'Dinheiro (espécie)']];
const nomeTipo = t => TIPOS.find(([k]) => k === t)?.[1] ?? 'Banco';

// "1.234,56", "1234,56" ou "1234.56" → número; vazio → null
function lerValor(txt) {
  const s = String(txt ?? '').trim().replace(/^R\$\s*/, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : NaN;
}
const mostrar = v => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const mesAnterior = ym => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

function CampoValor({ id, valor, onSalvar, desabilitado, rotulo }) {
  const [txt, setTxt] = useState(mostrar(valor));
  const [erro, setErro] = useState(false);
  function salvar() {
    const n = lerValor(txt);
    if (Number.isNaN(n)) { setErro(true); return; }
    setErro(false);
    if (n === valor || (n == null && valor == null)) { setTxt(mostrar(valor)); return; }
    onSalvar(n);
  }
  return (
    <input
      id={id}
      className={`fech-input${erro ? ' erro' : ''}`}
      inputMode="decimal" placeholder="digitar" aria-label={rotulo} aria-invalid={erro || undefined}
      value={txt} disabled={desabilitado}
      onChange={e => setTxt(e.target.value)} onBlur={salvar}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

// Saldo de cada conta no dia 1 do mês. Sem fechamento: o dia 1 do mês seguinte confere o mês anterior.
export default function SaldoContas({ lancamentos, clienteAtivo, mesFiltro, setMesFiltro, ano, setAno }) {
  const mesChave = `${ano}-${String(mesFiltro + 1).padStart(2, '0')}`;
  const [dados, setDados]     = useState(null);
  const [totais, setTotais]   = useState([]);
  const [erro, setErro]       = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [nova, setNova]       = useState(null);   // { nome, tipo } do formulário de conta nova

  const anos = useMemo(() => {
    const s = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    s.add(hoje().slice(0, 4));
    return [...s].sort().reverse();
  }, [lancamentos]);

  const recarregar = () => Promise.all([API.fechamentoBuscar(clienteAtivo.id, mesChave), API.fechamentoTotais(clienteAtivo.id)])
    .then(([d, t]) => { setDados(d); setTotais(t || []); });

  useEffect(() => {
    if (!clienteAtivo) return;
    let vivo = true;
    Promise.all([API.fechamentoBuscar(clienteAtivo.id, mesChave), API.fechamentoTotais(clienteAtivo.id)])
      .then(([d, t]) => { if (vivo) { setDados(d); setTotais(t || []); setErro(''); } })
      .catch(e => { if (vivo) setErro(e.message || 'Não consegui carregar os saldos. Tente de novo.'); });
    return () => { vivo = false; };
  }, [clienteAtivo, mesChave]);

  async function acao(fn, msg) {
    setOcupado(true); setErro('');
    try { await fn(); await recarregar(); }
    catch (e) { setErro(e.message || msg); }
    finally { setOcupado(false); }
  }
  const salvarSaldo = (contaId, valor) => acao(() => API.fechamentoSalvarSaldo(clienteAtivo.id, mesChave, contaId, 'inicial', valor), 'Não consegui salvar. Tente de novo.');
  const desativar   = c => acao(() => API.fechamentoEditarConta(clienteAtivo.id, c.id, { ativa: false }), 'Não consegui desativar a conta.');
  function criarConta(e) {
    e.preventDefault();
    if (!nova?.nome.trim()) return;
    acao(async () => { await API.fechamentoCriarConta(clienteAtivo.id, nova.nome.trim(), nova.tipo); setNova(null); }, 'Não consegui criar a conta.');
  }

  const contas  = dados?.contas || [];
  const ativas  = contas.filter(c => c.ativa);
  const informado = contas.some(c => c.inicial != null);
  const total   = contas.reduce((a, c) => a + (c.inicial || 0), 0);
  const dia1    = `01/${String(mesFiltro + 1).padStart(2, '0')}/${ano}`;

  // O que o sistema esperava para hoje: dia 1 do mês anterior (informado ou calculado) + o que foi lançado nele
  const anterior = mesAnterior(mesChave);
  const esperado = useMemo(() => {
    const base = caixaNoDia1(lancamentos, totais.filter(t => t.mes < mesChave), anterior);
    return base ? { valor: base.valor + resultadoCaixa(lancamentos, anterior).saldo, desde: base.desde } : null;
  }, [lancamentos, totais, mesChave, anterior]);
  const diferenca = esperado && informado ? total - esperado.valor : null;
  const margem    = Math.max(50, resultadoCaixa(lancamentos, anterior).ent * 0.01);   // arredondamento, troco, tarifa pequena
  const nomeAnt   = MESES_FULL[Number(anterior.slice(5)) - 1].toLowerCase();

  return (
    <div className="fech">
      <div className="fech-topo">
        <div>
          <h2 className="fech-titulo">Saldo das contas em {dia1}</h2>
          <p className="fech-sub">Quanto a loja tinha em cada conta e no caixa em espécie no primeiro dia do mês. Salva ao sair do campo.</p>
        </div>
        <div className="fech-periodo">
          <select id="saldo-mes" className="period-select" aria-label="Mês" value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select id="saldo-ano" className="period-select" aria-label="Ano" value={ano} onChange={e => setAno(e.target.value)}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {erro && <div className="fech-erro" role="alert">{erro}</div>}

      {!dados ? (
        !erro && <div className="fech-vazio">Carregando…</div>
      ) : (
        <div className="table-panel fech-painel" aria-busy={ocupado}>
          <div className="fech-tabela">
            <table>
              <thead><tr><th>Conta</th><th>Saldo em {dia1}</th></tr></thead>
              <tbody>
                {contas.map(c => (
                  <tr key={c.id} className={c.ativa ? '' : 'inativa'}>
                    <td>
                      <div className="fech-conta">
                        <span className={`fech-ico fech-ico-${c.tipo}`} aria-hidden="true">{c.tipo === 'especie' ? 'R$' : c.nome.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <div className="fech-cnome">{c.nome}</div>
                          <div className="fech-ctipo">
                            {nomeTipo(c.tipo)}{!c.ativa && ' · desativada'}
                            {c.ativa && <> · <button type="button" className="fech-link" onClick={() => desativar(c)} disabled={ocupado}>desativar</button></>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <CampoValor key={`${mesChave}-${c.inicial}`} id={`saldo-${c.id}`} valor={c.inicial} rotulo={`Saldo de ${c.nome} em ${dia1}`}
                        desabilitado={ocupado} onSalvar={v => salvarSaldo(c.id, v)} />
                    </td>
                  </tr>
                ))}
                <tr className="fech-add">
                  <td colSpan={2}>
                    {nova ? (
                      <form className="fech-add-form" onSubmit={criarConta}>
                        <input id="saldo-nova-nome" placeholder="Nome da conta (ex.: Itaú)" aria-label="Nome da conta" autoFocus
                          value={nova.nome} onChange={e => setNova(n => ({ ...n, nome: e.target.value }))} />
                        <select id="saldo-nova-tipo" aria-label="Tipo da conta" value={nova.tipo} onChange={e => setNova(n => ({ ...n, tipo: e.target.value }))}>
                          {TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        <button className="btn btn-primary btn-sm" type="submit" disabled={ocupado || !nova.nome.trim()}>Adicionar</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setNova(null)}>Cancelar</button>
                      </form>
                    ) : (
                      <button type="button" className="fech-link fech-link-add"
                        onClick={() => setNova({ nome: '', tipo: ativas.some(c => c.tipo === 'especie') ? 'banco' : 'especie' })}>
                        + Adicionar conta
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
              {contas.length > 0 && (
                <tfoot>
                  <tr><td>Total da loja</td><td className="num">{informado ? fmt(total) : '—'}</td></tr>
                </tfoot>
              )}
            </table>
          </div>

          {esperado && (
            <div className="fech-confere" aria-live="polite">
              <div className="fech-contas">
                <span>Pelo sistema, a loja começaria {MESES_FULL[mesFiltro].toLowerCase()} com</span><span className="num">{fmt(esperado.valor)}</span>
                <span>Informado nas contas</span><span className="num">{informado ? fmt(total) : '—'}</span>
              </div>
              {diferenca == null ? (
                <div className="fech-veredito neutro"><b>Informe os saldos para conferir {nomeAnt}</b><small>Sem saldo informado, o Fluxo de Caixa e o Balanço usam o valor calculado pelo sistema.</small></div>
              ) : Math.abs(diferenca) <= margem ? (
                <div className="fech-veredito ok"><b>✓ {MESES_FULL[Number(anterior.slice(5)) - 1]} bate com o sistema</b><small>Diferença de {fmt(Math.abs(diferenca))}, dentro da margem de {fmt(margem)}.</small></div>
              ) : (
                <div className="fech-veredito dif">
                  <b>{diferenca > 0 ? 'Sobrou' : 'Faltou'} {fmt(Math.abs(diferenca))} em {nomeAnt}</b>
                  <small>{diferenca > 0
                    ? 'Entrou mais dinheiro do que foi lançado: pode ser venda sem lançamento, aporte ou empréstimo.'
                    : 'Saiu mais dinheiro do que foi lançado: pode ser despesa, compra ou retirada sem lançamento.'}</small>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
