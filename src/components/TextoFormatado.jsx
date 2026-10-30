import './TextoFormatado.css';

const VALOR = /-?R\$\s?-?[\d.]+(?:,\d{1,2})?/;
const VALORES = new RegExp(VALOR.source, 'g');

// Markdown mínimo da IA (**negrito** e *itálico*) sem injetar HTML
function inline(linha) {
  return linha.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((parte, i) => {
    if (parte.length > 4 && parte.startsWith('**') && parte.endsWith('**')) return <strong key={i}>{parte.slice(2, -2)}</strong>;
    if (parte.length > 2 && parte.startsWith('*') && parte.endsWith('*')) return <em key={i}>{parte.slice(1, -1)}</em>;
    return parte;
  });
}

const semNegrito = t => t.replace(/\*\*/g, '').trim();

function numero(valor) {
  const n = parseFloat(String(valor).replace(/[^\d,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

// Cada linha da resposta vira um tipo de bloco
function classificar(linha) {
  const texto = linha.replace(/^#{1,6}\s+/, '').trim();
  if (!texto) return null;
  if (/^#{1,6}\s/.test(linha.trim()) || /^\*\*[^*]+\*\*:?$/.test(texto)) return { tipo: 'titulo', texto: semNegrito(texto).replace(/:$/, '') };

  if (/^\|.*\|$/.test(texto)) {
    if (/^[|\s:-]+$/.test(texto)) return { tipo: 'divisoria' };
    return { tipo: 'tabela', celulas: texto.slice(1, -1).split('|').map(c => semNegrito(c)) };
  }

  const total = texto.match(/^\*{0,2}Total\*{0,2}:?\*{0,2}\s*(-?R\$.*)$/i);
  if (total) return { tipo: 'total', valor: semNegrito(total[1]).replace(/[.!]$/, '') };

  const item = texto.match(/^(?:[-*•]|(\d{1,2})[.)])\s+(.*)$/);
  if (item) {
    const conteudo = item[2];
    const card = conteudo.match(/^\*\*([^*]+?):?\*\*:?\s+(.+)$/);
    if (card) {
      // Só vira número grande quando é o único do card: com vários, o primeiro nem sempre é o que importa
      const valores = card[2].match(VALORES) || [];
      const corpo = card[2].includes('**') ? card[2] : card[2].replace(VALORES, '**$&**');
      return { tipo: 'card', titulo: card[1], corpo, valor: valores.length === 1 ? valores[0] : null };
    }
    const partes = conteudo.split(/\s+[—–]\s+/);
    if (partes.length >= 2 && VALOR.test(partes.at(-1))) {
      const meio = partes.slice(1, -1).map(semNegrito).join(' · ');
      return { tipo: 'linha', nome: semNegrito(partes[0]), meio: /^\d+$/.test(meio) ? `${meio} ${meio === '1' ? 'lançamento' : 'lançamentos'}` : meio, valor: semNegrito(partes.at(-1)) };
    }
    return { tipo: 'lista', texto: conteudo, numerada: !!item[1] };
  }

  if (texto.endsWith(':') && texto.length <= 70 && !VALOR.test(texto)) return { tipo: 'titulo', texto: semNegrito(texto).slice(0, -1) };
  return { tipo: 'paragrafo', texto };
}

function agrupar(texto) {
  const blocos = [];
  for (const linha of texto.split('\n')) {
    const b = classificar(linha);
    if (!b || b.tipo === 'divisoria') continue;
    const ultimo = blocos.at(-1);
    if (b.tipo === 'total' && ultimo?.tipo === 'linha') ultimo.total = b.valor;
    else if (ultimo?.tipo === b.tipo && ['card', 'linha', 'lista', 'tabela'].includes(b.tipo)) ultimo.itens.push(b);
    else blocos.push(['card', 'linha', 'lista', 'tabela'].includes(b.tipo) ? { tipo: b.tipo, itens: [b] } : b);
  }
  return blocos;
}

function Linhas({ itens, total }) {
  const maior = Math.max(...itens.map(i => numero(i.valor)), 0);
  const comBarra = itens.length >= 3 && maior > 0;
  return (
    <div className="resp-linhas">
      {itens.map((l, i) => (
        <div key={i} className="resp-linha">
          <div className="resp-linha-topo">
            <span className="resp-linha-nome">{l.nome}{l.meio && <small>{l.meio}</small>}</span>
            <span className="resp-valor">{l.valor}</span>
          </div>
          {comBarra && <div className="resp-barra" aria-hidden="true"><span style={{ width: `${Math.max(2, (numero(l.valor) / maior) * 100)}%` }} /></div>}
        </div>
      ))}
      {total && <div className="resp-linha-total"><span>Total</span><span className="resp-valor">{total}</span></div>}
    </div>
  );
}

function Tabela({ itens }) {
  const [cabecalho, ...linhas] = itens.map(i => i.celulas);
  return (
    <div className="resp-tabela">
      <table>
        <thead><tr>{cabecalho.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function TextoFormatado({ texto }) {
  return (
    <div className="resp">
      {agrupar(texto).map((b, i) => {
        if (b.tipo === 'titulo') return <h4 key={i} className="resp-titulo">{b.texto}</h4>;
        if (b.tipo === 'paragrafo') return <p key={i}>{inline(b.texto)}</p>;
        if (b.tipo === 'total') return <div key={i} className="resp-linha-total"><span>Total</span><span className="resp-valor">{b.valor}</span></div>;
        if (b.tipo === 'linha') return <Linhas key={i} itens={b.itens} total={b.total} />;
        if (b.tipo === 'tabela') return <Tabela key={i} itens={b.itens} />;
        if (b.tipo === 'lista') {
          const Lista = b.itens[0].numerada ? 'ol' : 'ul';
          return <Lista key={i} className="resp-lista">{b.itens.map((l, j) => <li key={j}>{inline(l.texto)}</li>)}</Lista>;
        }
        return (
          <div key={i} className="resp-cards">
            {b.itens.map((c, j) => (
              <article key={j} className="resp-card">
                <h5>{c.titulo}</h5>
                {c.valor && <strong className="resp-card-valor">{c.valor}</strong>}
                <p>{inline(c.corpo)}</p>
              </article>
            ))}
          </div>
        );
      })}
    </div>
  );
}
