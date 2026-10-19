import { useState, useEffect, useMemo } from 'react';
import { API } from '../services/api';
import { CMVCATS } from '../services/constants';
import { fmt, MESES, MESES_FULL, hoje, upgradeNoCaixa } from '../services/utils';
import './FechamentoMes.css';

const TIPOS = [['banco', 'Banco'], ['maquininha', 'Maquininha'], ['especie', 'Dinheiro (espécie)']];
const nomeTipo = t => (TIPOS.find(([k]) => k === t) || [, 'Banco'])[1];

// "1.234,56", "1234,56" ou "1234.56" → número; vazio → null
function lerValor(txt) {
  const s = String(txt ?? '').trim().replace(/^R\$\s*/, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : NaN;
}
const mostrar = v => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const nomeMes = chave => { const [y, m] = chave.split('-'); return `${MESES_FULL[Number(m) - 1].toLowerCase()}${y !== hoje().slice(0, 4) ? ` de ${y}` : ''}`; };

// Mesmo cálculo do Fluxo de Caixa: entrada sem o aparelho recebido na troca, saída + taxa gravada na venda, sem CMV
function resultadoCaixa(lancamentos, pfx) {
  const lm = lancamentos.filter(l => l.data.startsWith(pfx) && !l.isCMV && !CMVCATS.includes(l.categoria) && !(l.tipo === 'Saída' && l.status === 'Pendente'));
  const ent = lm.filter(l => l.tipo === 'Entrada').reduce((a, l) => a + l.valor, 0) - lm.reduce((a, l) => a + upgradeNoCaixa(l), 0);
  const ded = lm.filter(l => l.tipo === 'Entrada' && l.valorRecebido != null).reduce((a, l) => a + (l.valor - l.valorRecebido), 0);
  const sai = lm.filter(l => l.tipo === 'Saída').reduce((a, l) => a + l.valor, 0) + ded;
  return { ent, sai, saldo: ent - sai };
}

function CampoValor({ id, valor, onSalvar, desabilitado, rotulo, destacar }) {
  const [txt, setTxt] = useState(mostrar(valor));
  const [erro, setErro] = useState(false);
  useEffect(() => { setTxt(mostrar(valor)); setErro(false); }, [valor]);
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
      className={`fech-input${destacar && valor == null ? ' vazio' : ''}${erro ? ' erro' : ''}`}
      inputMode="decimal" placeholder="digitar" aria-label={rotulo} aria-invalid={erro || undefined}
      value={txt} disabled={desabilitado}
      onChange={e => setTxt(e.target.value)} onBlur={salvar}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

export default function FechamentoMes({ lancamentos, clienteAtivo, mesFiltro, setMesFiltro, ano, setAno }) {
  const mesChave = `${ano}-${String(mesFiltro + 1).padStart(2, '0')}`;
  const [dados, setDados]       = useState(null);
  const [erro, setErro]         = useState('');
  const [ocupado, setOcupado]   = useState(false);
  const [ajustando, setAjust]   = useState(new Set());   // contas com o saldo inicial herdado aberto para edição
  const [nova, setNova]         = useState(null);        // { nome, tipo } do formulário de conta nova

  const anos = useMemo(() => {
    const s = new Set(lancamentos.map(l => l.data.slice(0, 4)));
    s.add(hoje().slice(0, 4));
    return [...s].sort().reverse();
  }, [lancamentos]);

  useEffect(() => {
    if (!clienteAtivo) return;
    setDados(null); setErro(''); setAjust(new Set());
    API.fechamentoBuscar(clienteAtivo.id, mesChave)
      .then(setDados)
      .catch(e => setErro(e.message || 'Não consegui carregar o fechamento. Tente de novo.'));
  }, [clienteAtivo, mesChave]);

  async function acao(fn) {
    setOcupado(true); setErro('');
    try { setDados(await fn()); }
    catch (e) { setErro(e.message || 'Não consegui salvar. Tente de novo.'); }
    finally { setOcupado(false); }
  }
  const salvarSaldo = (contaId, campo, valor) => acao(() => API.fechamentoSalvarSaldo(clienteAtivo.id, mesChave, contaId, campo, valor));

  async function criarConta(e) {
    e.preventDefault();
    if (!nova?.nome.trim()) return;
    setOcupado(true); setErro('');
    try {
      await API.fechamentoCriarConta(clienteAtivo.id, nova.nome.trim(), nova.tipo);
      setNova(null);
      setDados(await API.fechamentoBuscar(clienteAtivo.id, mesChave));
    } catch (e2) { setErro(e2.message || 'Não consegui criar a conta.'); }
    finally { setOcupado(false); }
  }
  async function desativar(c) {
    setOcupado(true); setErro('');
    try {
      await API.fechamentoEditarConta(clienteAtivo.id, c.id, { ativa: false });
      setDados(await API.fechamentoBuscar(clienteAtivo.id, mesChave));
    } catch (e) { setErro(e.message || 'Não consegui desativar a conta.'); }
    finally { setOcupado(false); }
  }

  const fechado  = !!dados?.fechado;
  const contas   = dados?.contas || [];
  const ativas   = contas.filter(c => c.ativa);
  const faltam   = ativas.filter(c => c.inicial == null || c.final == null).length;
  const completo = ativas.length > 0 && faltam === 0;
  const totIni   = contas.reduce((a, c) => a + (c.inicial || 0), 0);
  const totFim   = contas.reduce((a, c) => a + (c.final || 0), 0);
  const sistema  = useMemo(() => resultadoCaixa(lancamentos, mesChave), [lancamentos, mesChave]);
  const variacao = totFim - totIni;
  const diferenca = variacao - sistema.saldo;
  // Até 1% do que entrou no mês (mínimo R$ 50) é arredondamento, troco, tarifa pequena
  const margem   = Math.max(50, sistema.ent * 0.01);

  return (
    <div className="fech">
      <div className="fech-topo">
        <div>
          <h2 className="fech-titulo">Fechamento de {MESES_FULL[mesFiltro].toLowerCase()}</h2>
          <p className="fech-sub">Quanto a loja tem em cada conta e no caixa em espécie no último dia do mês. O início do mês vem do fechamento anterior.</p>
        </div>
        <div className="fech-periodo">
          <select className="period-select" aria-label="Mês" value={mesFiltro} onChange={e => setMesFiltro(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="period-select" aria-label="Ano" value={ano} onChange={e => setAno(e.target.value)}>
            {anos.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {erro && <div className="fech-erro" role="alert">{erro}</div>}

      {!dados ? (
        !erro && <div className="fech-vazio">Carregando…</div>
      ) : (
        <div className="table-panel fech-painel" aria-busy={ocupado}>
          <div className="fech-painel-cab">
            <strong>Saldos</strong>
            <span className="fech-nota">
              {fechado ? `Fechado${dados.fechado.por ? ` por ${dados.fechado.por}` : ''} em ${new Date(dados.fechado.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : !ativas.length ? 'Cadastre as contas da loja para começar'
                : faltam ? `Falta${faltam > 1 ? 'm' : ''} ${faltam} conta${faltam > 1 ? 's' : ''}` : 'Todas as contas preenchidas'}
            </span>
          </div>

          <div className="fech-tabela">
            <table>
              <thead><tr><th>Conta</th><th>Início do mês</th><th>Fim do mês</th><th>Variação</th></tr></thead>
              <tbody>
                {contas.map(c => {
                  const herdado = c.inicialOrigem && c.inicialOrigem !== 'digitado';
                  const editandoIni = !herdado || ajustando.has(c.id);
                  return (
                    <tr key={c.id} className={c.ativa ? '' : 'inativa'}>
                      <td>
                        <div className="fech-conta">
                          <span className={`fech-ico fech-ico-${c.tipo}`} aria-hidden="true">{c.tipo === 'especie' ? 'R$' : c.nome.slice(0, 2).toUpperCase()}</span>
                          <div>
                            <div className="fech-cnome">{c.nome}</div>
                            <div className="fech-ctipo">
                              {nomeTipo(c.tipo)}{!c.ativa && ' · desativada'}
                              {c.ativa && !fechado && <> · <button type="button" className="fech-link" onClick={() => desativar(c)} disabled={ocupado}>desativar</button></>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {editandoIni && !fechado ? (
                          <CampoValor id={`fech-ini-${c.id}`} valor={c.inicial} rotulo={`Saldo no início do mês de ${c.nome}`} destacar={c.ativa}
                            desabilitado={ocupado} onSalvar={v => salvarSaldo(c.id, 'inicial', v)} />
                        ) : (
                          <span className="num">{c.inicial == null ? '—' : fmt(c.inicial)}</span>
                        )}
                        {herdado && !ajustando.has(c.id) && (
                          <span className="fech-origem">
                            do fechamento de {nomeMes(c.inicialOrigem)}
                            {!fechado && <> · <button type="button" className="fech-link" onClick={() => setAjust(s => new Set(s).add(c.id))}>ajustar</button></>}
                          </span>
                        )}
                        {c.inicialOrigem === 'digitado' && !fechado && <span className="fech-origem">digitado neste mês</span>}
                      </td>
                      <td>
                        {fechado ? <span className="num fech-forte">{c.final == null ? '—' : fmt(c.final)}</span>
                          : <CampoValor id={`fech-fim-${c.id}`} valor={c.final} rotulo={`Saldo no fim do mês de ${c.nome}`} destacar={c.ativa}
                              desabilitado={ocupado} onSalvar={v => salvarSaldo(c.id, 'final', v)} />}
                      </td>
                      <td className="num">
                        {c.inicial != null && c.final != null && (
                          <span style={{ color: c.final - c.inicial >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{c.final - c.inicial >= 0 ? '+' : ''}{fmt(c.final - c.inicial)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!fechado && (
                  <tr className="fech-add">
                    <td colSpan={4}>
                      {nova ? (
                        <form className="fech-add-form" onSubmit={criarConta}>
                          <input id="fech-nova-nome" placeholder="Nome da conta (ex.: Itaú)" aria-label="Nome da conta" autoFocus
                            value={nova.nome} onChange={e => setNova(n => ({ ...n, nome: e.target.value }))} />
                          <select id="fech-nova-tipo" aria-label="Tipo da conta" value={nova.tipo} onChange={e => setNova(n => ({ ...n, tipo: e.target.value }))}>
                            {TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                          <button className="btn btn-primary btn-sm" type="submit" disabled={ocupado || !nova.nome.trim()}>Adicionar</button>
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setNova(null)}>Cancelar</button>
                        </form>
                      ) : (
                        <button type="button" className="fech-link fech-link-add"
                          onClick={() => setNova({ nome: '', tipo: contas.some(c => c.tipo === 'especie' && c.ativa) ? 'banco' : 'especie' })}>
                          + Adicionar conta
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
              {contas.length > 0 && (
                <tfoot>
                  <tr>
                    <td>Total da loja</td>
                    <td className="num">{fmt(totIni)}</td>
                    <td className="num">{completo || fechado ? fmt(totFim) : '—'}</td>
                    <td className="num">{completo || fechado ? `${variacao >= 0 ? '+' : ''}${fmt(variacao)}` : '—'}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {ativas.length > 0 && (
            <div className="fech-confere" aria-live="polite">
              <div className="fech-contas">
                <span>Entradas lançadas no mês</span><span className="num" style={{ color: 'var(--entrada)' }}>+{fmt(sistema.ent)}</span>
                <span>Saídas lançadas no mês</span><span className="num" style={{ color: 'var(--saida)' }}>−{fmt(sistema.sai)}</span>
                <span className="tot">Resultado no sistema</span><span className="num tot">{sistema.saldo >= 0 ? '+' : ''}{fmt(sistema.saldo)}</span>
                <span>Variação do dinheiro da loja</span><span className="num">{completo || fechado ? `${variacao >= 0 ? '+' : ''}${fmt(variacao)}` : 'preencha todas as contas'}</span>
              </div>
              {!(completo || fechado) ? (
                <div className="fech-veredito neutro"><b>Esperando os saldos</b><small>Com todas as contas preenchidas, o sistema compara o dinheiro da loja com o que foi lançado.</small></div>
              ) : Math.abs(diferenca) <= margem ? (
                <div className="fech-veredito ok"><b>✓ Bate com o sistema</b><small>Diferença de {fmt(Math.abs(diferenca))}, dentro da margem de {fmt(margem)}.</small></div>
              ) : (
                <div className="fech-veredito dif">
                  <b>{diferenca > 0 ? 'Sobrou' : 'Faltou'} {fmt(Math.abs(diferenca))} em relação ao sistema</b>
                  <small>{diferenca > 0
                    ? 'Entrou mais dinheiro do que foi lançado: pode ser venda sem lançamento, aporte ou empréstimo.'
                    : 'Saiu mais dinheiro do que foi lançado: pode ser despesa, compra ou retirada sem lançamento.'}</small>
                </div>
              )}
            </div>
          )}

          {ativas.length > 0 && (
            <div className="fech-rodape">
              <span className="fech-nota">{fechado ? 'O total foi para o Balanço Patrimonial (Capital Liq em Caixa).' : 'Ao fechar, o total vai para o Balanço Patrimonial deste mês.'}</span>
              {fechado ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => acao(() => API.fechamentoReabrir(clienteAtivo.id, mesChave))}>Reabrir</button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" disabled={ocupado || !completo} onClick={() => acao(() => API.fechamentoFechar(clienteAtivo.id, mesChave))}>
                  Fechar {MESES_FULL[mesFiltro].toLowerCase()}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
