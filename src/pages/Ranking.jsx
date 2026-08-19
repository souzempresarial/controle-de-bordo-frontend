import { useEffect, useState } from 'react';
import { API } from '../services/api';
import { fmt } from '../services/utils';

const mesAtual = new Date().toISOString().slice(0, 7);

const MEDALHAS = ['🥇', '🥈', '🥉'];

function KPI({ label, valor, cor, small }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontSize: small ? 13 : 15, fontWeight: 700, color: cor || 'var(--text)' }}>{valor}</span>
    </div>
  );
}

function BarraProgresso({ pct, cor }) {
  return (
    <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', margin: '10px 0' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: cor, borderRadius: 2, transition: 'width .5s ease' }} />
    </div>
  );
}

export default function Ranking() {
  const [dados, setDados]     = useState([]);
  const [aba, setAba]         = useState('dre');
  const [mes, setMes]         = useState(mesAtual);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState('');

  useEffect(() => {
    setLoading(true); setErro('');
    API.ranking(mes || null)
      .then(setDados)
      .catch(() => setErro('Não foi possível carregar o ranking.'))
      .finally(() => setLoading(false));
  }, [mes]);

  const ordenadosDRE = [...dados].sort((a, b) => b.lucroLiq - a.lucroLiq);
  const ordenadosDFC = [...dados].sort((a, b) => b.geracaoCaixa - a.geracaoCaixa);
  const lista = aba === 'dre' ? ordenadosDRE : ordenadosDFC;

  const maxDRE = Math.max(...dados.map(d => d.lucroLiq), 1);
  const maxDFC = Math.max(...dados.map(d => d.geracaoCaixa), 1);

  const totalReceita    = dados.reduce((s, d) => s + d.receita, 0);
  const totalLucro      = dados.reduce((s, d) => s + d.lucroLiq, 0);
  const totalCaixaEntr  = dados.reduce((s, d) => s + d.dfcEntradas, 0);
  const totalGeracaoCx  = dados.reduce((s, d) => s + d.geracaoCaixa, 0);
  const lucratividadeMedia = totalReceita > 0 ? (totalLucro / totalReceita * 100) : 0;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Performance de Clientes</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text2)' }}>Lançamentos confirmados · base {aba === 'dre' ? 'competência (DRE)' : 'caixa (DFC)'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '6px 10px', fontSize: 13 }}
          />
          {mes && (
            <button onClick={() => setMes('')}
              style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>
              Ver tudo
            </button>
          )}
        </div>
      </div>

      {/* Resumo geral */}
      {!loading && !erro && dados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Receita Total', valor: fmt(totalReceita), cor: 'var(--entrada)' },
            { label: 'Lucro Total', valor: fmt(totalLucro), cor: totalLucro >= 0 ? 'var(--entrada)' : 'var(--saida)' },
            { label: 'Lucratividade Média', valor: `${lucratividadeMedia.toFixed(1)}%`, cor: lucratividadeMedia >= 0 ? 'var(--entrada)' : 'var(--saida)' },
            { label: 'Entradas de Caixa', valor: fmt(totalCaixaEntr), cor: 'var(--text)' },
            { label: 'Geração de Caixa', valor: fmt(totalGeracaoCx), cor: totalGeracaoCx >= 0 ? 'var(--entrada)' : 'var(--saida)' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text2)', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: k.cor }}>{k.valor}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs DRE / DFC */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[['dre', 'Resultado (DRE)'], ['dfc', 'Caixa (DFC)']].map(([v, l]) => (
          <button key={v} onClick={() => setAba(v)}
            style={{
              padding: '7px 20px', borderRadius: 7, fontSize: 13, fontWeight: aba === v ? 700 : 500,
              background: aba === v ? 'var(--surface)' : 'transparent',
              color: aba === v ? 'var(--text)' : 'var(--text2)',
              border: aba === v ? '1px solid var(--border)' : '1px solid transparent',
              cursor: 'pointer', transition: 'all .15s',
            }}>
            {l}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--text2)', fontSize: 14 }}>Carregando...</p>}
      {erro    && <p style={{ color: 'var(--saida)', fontSize: 14 }}>{erro}</p>}

      {/* Lista */}
      {!loading && !erro && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lista.map((c, i) => {
            const isTop3 = i < 3;
            const corBorda = i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--border)';

            if (aba === 'dre') {
              const pct = maxDRE > 0 ? (c.lucroLiq / maxDRE * 100) : 0;
              return (
                <div key={c.id} style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isTop3 ? corBorda : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: '16px 20px',
                  boxShadow: isTop3 ? `0 0 0 1px ${corBorda}22` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: isTop3 ? 22 : 16, minWidth: 36, textAlign: 'center' }}>
                      {isTop3 ? MEDALHAS[i] : <span style={{ fontWeight: 800, color: 'var(--text2)', fontSize: 14 }}>#{i + 1}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{c.nome}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Lucro Líquido</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: c.lucroLiq >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(c.lucroLiq)}</div>
                    </div>
                  </div>
                  <BarraProgresso pct={pct} cor={c.lucroLiq >= 0 ? 'var(--entrada)' : 'var(--saida)'} />
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <KPI label="Receita" valor={fmt(c.receita)} cor="var(--entrada)" />
                    <KPI label="CMV" valor={fmt(c.cmv)} cor="var(--saida)" />
                    <KPI label="Lucro Bruto" valor={fmt(c.lucroBruto)} cor={c.lucroBruto >= 0 ? 'var(--entrada)' : 'var(--saida)'} />
                    <KPI label="Despesas" valor={fmt(c.sga + c.naoOp)} cor="var(--saida)" />
                    <KPI label="Lucratividade" valor={`${c.lucratividade.toFixed(1)}%`} cor={c.lucratividade >= 0 ? 'var(--entrada)' : 'var(--saida)'} />
                  </div>
                </div>
              );
            }

            // DFC
            const pct = maxDFC > 0 ? (c.geracaoCaixa / maxDFC * 100) : 0;
            return (
              <div key={c.id} style={{
                background: 'var(--surface)',
                border: `1px solid ${isTop3 ? corBorda : 'var(--border)'}`,
                borderRadius: 14,
                padding: '16px 20px',
                boxShadow: isTop3 ? `0 0 0 1px ${corBorda}22` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: isTop3 ? 22 : 16, minWidth: 36, textAlign: 'center' }}>
                    {isTop3 ? MEDALHAS[i] : <span style={{ fontWeight: 800, color: 'var(--text2)', fontSize: 14 }}>#{i + 1}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.nome}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Geração de Caixa</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: c.geracaoCaixa >= 0 ? 'var(--entrada)' : 'var(--saida)' }}>{fmt(c.geracaoCaixa)}</div>
                  </div>
                </div>
                <BarraProgresso pct={pct} cor={c.geracaoCaixa >= 0 ? 'var(--entrada)' : 'var(--saida)'} />
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <KPI label="Entradas" valor={fmt(c.dfcEntradas)} cor="var(--entrada)" />
                  <KPI label="Saídas" valor={fmt(c.dfcSaidas)} cor="var(--saida)" />
                  <KPI label="Geração de Caixa" valor={fmt(c.geracaoCaixa)} cor={c.geracaoCaixa >= 0 ? 'var(--entrada)' : 'var(--saida)'} />
                </div>
              </div>
            );
          })}
          {lista.length === 0 && <p style={{ color: 'var(--text2)', fontSize: 14 }}>Nenhum dado encontrado.</p>}
        </div>
      )}
    </div>
  );
}
