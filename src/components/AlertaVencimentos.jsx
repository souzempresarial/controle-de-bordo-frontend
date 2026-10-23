import { fmt, hoje } from '../services/utils';
import './AlertaVencimentos.css';

// Contas a pagar vencidas ou vencendo em até 7 dias, na coluna da direita da Visão Geral
function diasAte(dataISO) {
  const alvo = new Date(String(dataISO).slice(0, 10) + 'T00:00:00');
  const base = new Date(hoje() + 'T00:00:00');
  return Math.round((alvo - base) / 86400000);
}

function textoPrazo(dias) {
  if (dias < -1) return `Venceu há ${-dias} dias`;
  if (dias === -1) return 'Venceu ontem';
  if (dias === 0)  return 'Vence hoje';
  if (dias === 1)  return 'Vence amanhã';
  return `Vence em ${dias} dias`;
}

export default function AlertaVencimentos({ contas, onVerContas }) {
  const proximas = (contas || [])
    .filter(c => c.tipo === 'pagar' && c.status === 'pendente' && c.vencimento)
    .map(c => ({ ...c, dias: diasAte(c.vencimento) }))
    .filter(c => c.dias <= 7)
    .sort((a, b) => a.dias - b.dias);

  const vencidas = proximas.filter(c => c.dias < 0);
  const hojeOuAmanha = proximas.filter(c => c.dias === 0 || c.dias === 1);
  const semana = proximas.filter(c => c.dias > 1);
  const total = proximas.reduce((s, c) => s + parseFloat(c.valor || 0), 0);
  const totalVencido = vencidas.reduce((s, c) => s + parseFloat(c.valor || 0), 0);
  const nivel = vencidas.length || hojeOuAmanha.length ? 'urgente' : proximas.length ? 'aviso' : 'ok';

  return (
    <section className={`contas-painel contas-painel-${nivel}`} aria-label="Contas a pagar">
      <div className="contas-painel-topo">
        <h2>Contas a pagar</h2>
        <button className="btn btn-ghost btn-sm" onClick={onVerContas}>Ver contas</button>
      </div>

      {!proximas.length ? (
        <div className="contas-painel-vazio">
          <span aria-hidden="true">✓</span>
          <strong>Nada vencido</strong>
          <small>Nenhuma conta vence nos próximos 7 dias.</small>
        </div>
      ) : (
        <>
          <div className="contas-painel-resumo">
            <div className="contas-painel-total">
              <small>Total a pagar · até 7 dias</small>
              <strong>{fmt(total)}</strong>
            </div>
            <div className="contas-painel-chips">
              {vencidas.length > 0 && <span className="chip vencida">{vencidas.length} vencida{vencidas.length > 1 ? 's' : ''} · {fmt(totalVencido)}</span>}
              {hojeOuAmanha.length > 0 && <span className="chip urgente">{hojeOuAmanha.length} hoje/amanhã</span>}
              {semana.length > 0 && <span className="chip aviso">{semana.length} nos próximos dias</span>}
            </div>
          </div>
          <ul className="contas-painel-lista">
            {proximas.map(c => (
              <li key={c.id}>
                <div className="contas-painel-desc">
                  <span>{c.descricao || c.subcategoria || c.categoria || 'Conta sem descrição'}</span>
                  <small className={c.dias < 0 ? 'vencida' : c.dias <= 1 ? 'urgente' : ''}>{textoPrazo(c.dias)}</small>
                </div>
                <span className="contas-painel-valor">{fmt(parseFloat(c.valor || 0))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
