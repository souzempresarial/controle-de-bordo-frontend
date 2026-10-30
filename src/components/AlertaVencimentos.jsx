import { fmt, hoje, MESES } from '../services/utils';
import Icone from './Icone';
import './AlertaVencimentos.css';

// Contas a pagar vencidas ou vencendo em até 7 dias, na coluna da direita da Visão Geral
const JANELA_DIAS = 7;

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

const valorDe = c => parseFloat(c.valor || 0);
const somar = lista => lista.reduce((s, c) => s + valorDe(c), 0);
const nomeDe = c => c.descricao || c.subcategoria || c.categoria || 'Conta sem descrição';

function DataConta({ iso }) {
  const [, mes, dia] = String(iso).slice(0, 10).split('-');
  return (
    <span className="contas-painel-data" aria-hidden="true">
      <b>{dia}</b>
      <small>{MESES[Number(mes) - 1]}</small>
    </span>
  );
}

export default function AlertaVencimentos({ contas, onVerContas }) {
  const pendentes = (contas || [])
    .filter(c => c.tipo === 'pagar' && c.status === 'pendente' && c.vencimento)
    .map(c => ({ ...c, dias: diasAte(c.vencimento) }))
    .sort((a, b) => a.dias - b.dias);
  const proximas = pendentes.filter(c => c.dias <= JANELA_DIAS);
  const seguinte = pendentes.find(c => c.dias > JANELA_DIAS);

  const grupos = [
    { id: 'vencidas', titulo: 'Vencidas', lista: proximas.filter(c => c.dias < 0) },
    { id: 'urgentes', titulo: 'Hoje e amanhã', lista: proximas.filter(c => c.dias === 0 || c.dias === 1) },
    { id: 'semana', titulo: 'Próximos dias', lista: proximas.filter(c => c.dias > 1) },
  ].filter(g => g.lista.length);

  const total = somar(proximas);
  const qtd = proximas.length;

  return (
    <section className="contas-painel" aria-label="Contas a pagar">
      <div className="contas-painel-topo">
        <h2>Contas a pagar</h2>
        <button className="btn btn-ghost btn-sm" onClick={onVerContas}>Ver todas</button>
      </div>

      {!qtd ? (
        <div className="contas-painel-vazio">
          <span aria-hidden="true"><Icone nome="check" tamanho={18} traco={2.6} /></span>
          <strong>Tudo em dia</strong>
          <small>Nenhuma conta vencida ou vencendo nos próximos {JANELA_DIAS} dias.</small>
          {seguinte && <small className="contas-painel-seguinte">Próxima: <b>{nomeDe(seguinte)}</b>, {fmt(valorDe(seguinte))} em {seguinte.dias} dias</small>}
        </div>
      ) : (
        <>
          <div className="contas-painel-resumo">
            <small>Próximos {JANELA_DIAS} dias</small>
            <strong>{fmt(total)}</strong>
            <span className="contas-painel-qtd">{qtd} conta{qtd > 1 ? 's' : ''} a pagar</span>
            <div className="contas-painel-barra" aria-hidden="true">
              {grupos.map(g => <i key={g.id} className={g.id} style={{ flexGrow: Math.max(somar(g.lista), total * 0.04) }} />)}
            </div>
          </div>

          <div className="contas-painel-lista">
            {grupos.map(g => (
              <section key={g.id} className="contas-painel-grupo" aria-label={g.titulo}>
                <header className={g.id}>
                  <span>{g.id === 'vencidas' && <Icone nome="alerta" tamanho={13} />}{g.titulo}</span>
                  <b>{fmt(somar(g.lista))}</b>
                </header>
                <ul>
                  {g.lista.map(c => (
                    <li key={c.id}>
                      <DataConta iso={c.vencimento} />
                      <div className="contas-painel-desc">
                        <span title={nomeDe(c)}>{nomeDe(c)}</span>
                        <small className={g.id}>{textoPrazo(c.dias)}</small>
                      </div>
                      <span className="contas-painel-valor">{fmt(valorDe(c))}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
