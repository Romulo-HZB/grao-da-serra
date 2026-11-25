// =====================================================================
// app.js — telas, navegação e eventos da interface
//
// Regra de ouro: a interface NÃO calcula totais, descontos nem estoque.
// Ela só exibe o que as views devolvem e aciona as procedures pelo
// módulo API (api.js). Depois de cada operação, os dados são
// recarregados, porque os triggers alteram estoque e situação no banco.
// =====================================================================

// ------------------------------ estado da tela -----------------------
const estado = {
  pedidoAtual: lerPedidoSalvo(), // nº do pedido em montagem (ou null)
  produtoSel: null,              // produto escolhido no seletor
  clienteSel: null,              // cliente escolhido para abrir pedido
  funcionarioSel: null,          // atendente escolhido para abrir pedido
  categoriaFiltro: '',           // filtro do cardápio
  categoriaPedido: '',           // filtro do seletor de produtos
  categoriaReajuste: null,       // categoria escolhida no reajuste
  statusFiltro: '',              // filtro da tela de pedidos
  cardapioPedido: []             // último cardápio carregado no Novo pedido
};

// ------------------------------ utilidades ---------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = (v) => moeda.format(Number(v) || 0);
const percentual = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
// Preço com o "R$" menor, para os cartões do cardápio
const precoGrande = (v) => `<small>R$</small>${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// Código do produto (id_produto) com dois dígitos: 5 -> '05'
const codigo = (id) => String(id).padStart(2, '0');

// Evita que nomes vindos do banco sejam interpretados como HTML
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// '2026-11-10 14:25:00' -> { data: '10/11/2026', hora: '14:25' }
function dataHora(texto) {
  if (!texto) return { data: '', hora: '' };
  const [d, h = ''] = texto.split(' ');
  const [ano, mes, dia] = d.split('-');
  return { data: `${dia}/${mes}/${ano}`, hora: h.slice(0, 5) };
}

// Nome da categoria -> apelido usado nas cores e ícones
function slugCategoria(nome) {
  const n = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (n.includes('cafe')) return 'cafes';
  if (n.includes('gelad') || n.includes('bebida')) return 'geladas';
  if (n.includes('salgad')) return 'salgados';
  if (n.includes('doce')) return 'doces';
  if (n.includes('emporio')) return 'emporio';
  return '';
}
const iconeCategoria = (nome) => {
  const slug = slugCategoria(nome);
  return `<span class="ico-cat" data-cat="${slug}"><svg><use href="#c-${slug || 'cafes'}"/></svg></span>`;
};

// Iniciais para o avatar: 'Ana Beatriz Schroeder' -> 'AS'
function iniciais(nome) {
  const partes = String(nome).trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
const CORES_AVATAR = ['#7a4a2e', '#1f7f86', '#c26a12', '#b8457a', '#5f7a23', '#4b4f9c'];

// O nº do pedido em andamento sobrevive a um recarregar da página
function lerPedidoSalvo() {
  try { return Number(localStorage.getItem('gs_pedido')) || null; } catch { return null; }
}
function salvarPedido(id) {
  estado.pedidoAtual = id;
  try { id ? localStorage.setItem('gs_pedido', id) : localStorage.removeItem('gs_pedido'); } catch { /* sem armazenamento */ }
  const badge = $('#badgePedido');
  badge.hidden = !id;
  badge.textContent = id ? `#${id}` : '';
}

// Indicador "banco conectado" no rodapé da barra lateral
function statusBanco(ok, texto) {
  const el = $('#statusBanco');
  el.className = `status-banco ${ok ? 'on' : 'off'}`;
  el.querySelector('span').textContent = texto;
}

// ------------------------------ mensagens ----------------------------
// Local fixo da tela para as mensagens do banco (SIGNAL) e confirmações.
function mostrarMensagem(texto, tipo = 'erro') {
  const caixa = document.createElement('div');
  caixa.className = `msg msg-${tipo}`;
  caixa.innerHTML = `
    <span class="msg-icone"><svg><use href="#${tipo === 'erro' ? 'i-alerta' : 'i-check'}"/></svg></span>
    <p><span class="msg-titulo">${tipo === 'erro' ? 'O banco recusou a operação' : 'Tudo certo'}</span>${esc(texto)}</p>
    <button type="button" aria-label="Fechar mensagem"><svg><use href="#i-x"/></svg></button>`;
  caixa.querySelector('button').onclick = () => caixa.remove();
  const area = $('#mensagens');
  area.prepend(caixa);
  // No máximo 3 mensagens; as de sucesso somem sozinhas, as de erro ficam até fechar
  [...area.children].slice(3).forEach((m) => m.remove());
  if (tipo === 'ok') setTimeout(() => caixa.remove(), 4500);
}
const limparMensagens = () => { $('#mensagens').innerHTML = ''; };

// Executa uma operação mostrando o erro (se houver) na área de mensagens
async function executar(operacao, botao) {
  if (botao) botao.disabled = true;
  try {
    const r = await operacao();
    statusBanco(true, 'Banco conectado');
    return r;
  } catch (e) {
    if (/conectar|comunicação/i.test(e.message)) statusBanco(false, 'Banco desconectado');
    mostrarMensagem(e.message, 'erro');
    return undefined;
  } finally {
    if (botao) botao.disabled = false;
  }
}

// ------------------------------ navegação ----------------------------
const carregadores = {
  cardapio: carregarCardapio,
  novo: carregarNovoPedido,
  pedidos: carregarPedidos,
  gerencia: carregarGerencia
};

function irPara(tela) {
  $$('.nav-btn').forEach((b) => b.classList.toggle('ativo', b.dataset.tela === tela));
  $$('.tela').forEach((t) => t.classList.toggle('ativa', t.id === `tela-${tela}`));
  limparMensagens();
  window.scrollTo({ top: 0 });
  carregadores[tela]();
}

// Agrupa as linhas da view vw_cardapio por categoria
function agruparPorCategoria(linhas) {
  const grupos = new Map();
  for (const l of linhas) {
    if (!grupos.has(l.categoria)) grupos.set(l.categoria, []);
    grupos.get(l.categoria).push(l);
  }
  return grupos;
}

// Abas de categoria (com ícone e quantidade). Usadas no cardápio e no pedido.
function renderizarAbas(container, grupos, ativa, aoEscolher) {
  const total = [...grupos.values()].reduce((s, g) => s + g.length, 0);
  container.innerHTML =
    `<button class="aba ${ativa === '' ? 'ativo' : ''}" data-valor="">Todas <span class="qtd">${total}</span></button>` +
    [...grupos.entries()].map(([cat, itens]) => `
      <button class="aba ${cat === ativa ? 'ativo' : ''}" data-valor="${esc(cat)}" data-cat="${slugCategoria(cat)}">
        <svg><use href="#c-${slugCategoria(cat) || 'cafes'}"/></svg>${esc(cat)} <span class="qtd">${itens.length}</span>
      </button>`).join('');
  container.querySelectorAll('.aba').forEach((b) => { b.onclick = () => aoEscolher(b.dataset.valor); });
}

// =====================================================================
// TELA 1 — CARDÁPIO (vw_cardapio)
// =====================================================================
async function carregarCardapio() {
  const linhas = await executar(() => API.listarCardapio());
  if (!linhas) return;
  const grupos = agruparPorCategoria(linhas);

  renderizarAbas($('#filtroCategorias'), grupos, estado.categoriaFiltro, (cat) => {
    estado.categoriaFiltro = cat;
    carregarCardapio();
  });

  let html = '';
  for (const [categoria, produtos] of grupos) {
    if (estado.categoriaFiltro && categoria !== estado.categoriaFiltro) continue;
    html += `
      <div class="grupo">
        <div class="grupo-topo">
          ${iconeCategoria(categoria)}
          <div>
            <h2>${esc(categoria)}</h2>
            <p>${produtos.length} ${produtos.length === 1 ? 'produto' : 'produtos'}</p>
          </div>
        </div>
        <div class="grade-produtos">${produtos.map(cartaoProduto).join('')}</div>
      </div>`;
  }
  $('#cardapioLista').innerHTML = html || '<div class="vazio">Nenhum produto no cardápio.</div>';
}

function cartaoProduto(p) {
  const esgotado = p.situacao === 'ESGOTADO';
  const selo = {
    OK: '<span class="selo selo-OK">Disponível</span>',
    REPOR: '<span class="selo selo-REPOR">Últimas unidades</span>',
    ESGOTADO: '<span class="selo selo-ESGOTADO">Esgotado</span>'
  }[p.situacao] || '';
  return `
    <article class="produto ${esgotado ? 'esgotado' : ''}" data-cat="${slugCategoria(p.categoria)}" aria-disabled="${esgotado}">
      <div class="produto-cabeca">
        ${iconeCategoria(p.categoria)}
        <span class="codigo">CÓD. ${codigo(p.id_produto)}</span>
      </div>
      <div class="produto-nome">${esc(p.produto)}</div>
      <div class="produto-rodape">
        <span class="preco">${precoGrande(p.preco)}</span>
        ${selo}
      </div>
    </article>`;
}

// =====================================================================
// TELA 2 — NOVO PEDIDO
// =====================================================================
let cadastrosCarregados = false;

async function carregarNovoPedido() {
  // Clientes e funcionários (carregados uma vez)
  if (!cadastrosCarregados) {
    const dados = await executar(() => Promise.all([API.listarClientes(), API.listarFuncionarios()]));
    if (dados) {
      const [clientes, funcionarios] = dados;
      $('#listaClientes').innerHTML = clientes.map((c, i) => `
        <button type="button" class="pessoa" data-id="${c.id_cliente}" data-nome="${esc(c.nome)}">
          <span class="avatar" style="--av:${CORES_AVATAR[i % CORES_AVATAR.length]}">${esc(iniciais(c.nome))}</span>
          <span class="pessoa-info"><strong>${esc(c.nome)}</strong><span>${esc(c.cpf)}</span></span>
        </button>`).join('');
      $('#listaFuncionarios').innerHTML = funcionarios.map((f) => `
        <button type="button" class="pessoa" data-id="${f.id_funcionario}" data-nome="${esc(f.nome)}">
          <span class="avatar">${esc(iniciais(f.nome))}</span>
          <span class="pessoa-info"><strong>${esc(f.nome)}</strong><span>${esc(f.cargo)}</span></span>
        </button>`).join('');
      ligarEscolha('#listaClientes', 'clienteSel');
      ligarEscolha('#listaFuncionarios', 'funcionarioSel');
      cadastrosCarregados = true;
    }
  }

  if (estado.pedidoAtual) {
    await carregarPedidoAtual();
  } else {
    mostrarPasso('abrir');
  }
}

// Seleção de cliente / atendente por cartões
function ligarEscolha(lista, chave) {
  $$(`${lista} .pessoa`).forEach((b) => {
    b.onclick = () => {
      estado[chave] = { id: Number(b.dataset.id), nome: b.dataset.nome };
      $$(`${lista} .pessoa`).forEach((o) => o.classList.toggle('selecionada', o === b));
      atualizarResumoAbrir();
    };
  });
}

function atualizarResumoAbrir() {
  const c = estado.clienteSel, f = estado.funcionarioSel;
  $('#btnAbrir').disabled = !(c && f);
  $('#resumoAbrir').innerHTML = c && f
    ? `Pedido para <b>${esc(c.nome)}</b>, atendido por <b>${esc(f.nome)}</b>.`
    : c ? `Cliente: <b>${esc(c.nome)}</b>. Agora escolha o atendente.`
    : f ? `Atendente: <b>${esc(f.nome)}</b>. Agora escolha o cliente.`
    : 'Escolha o cliente e o atendente.';
}

function mostrarPasso(passo) {
  $('#boxAbrir').hidden = passo !== 'abrir';
  $('#boxMontagem').hidden = passo !== 'montar';
  $('#boxRecibo').hidden = passo !== 'recibo';
  $('#novoSobretitulo').textContent =
    { abrir: 'Passo 1 de 2 · Identificação', montar: 'Passo 2 de 2 · Montagem', recibo: 'Concluído' }[passo];
}

// Recarrega o pedido em montagem: cabeçalho, itens e produtos disponíveis
async function carregarPedidoAtual() {
  const id = estado.pedidoAtual;
  const dados = await executar(() => Promise.all([
    API.obterPedido(id), API.listarItensPedido(id), API.listarCardapio()
  ]));
  if (!dados) return;
  const [pedido, itens, cardapio] = dados;

  // O pedido pode ter sido finalizado em outro terminal
  if (!pedido || pedido.status !== 'ABERTO') {
    salvarPedido(null);
    mostrarPasso('abrir');
    if (pedido) mostrarMensagem(`O pedido #${id} não está mais aberto (${pedido.status}).`, 'erro');
    return;
  }

  mostrarPasso('montar');

  // Comanda
  $('#comandaNumero').textContent = `#${pedido.id_pedido}`;
  $('#comandaQuem').innerHTML = `<b>${esc(pedido.cliente)}</b> · atendido por ${esc(pedido.atendente)}`;
  $('#comandaBruto').textContent = dinheiro(pedido.valor_bruto); // vem de fn_total_pedido
  $('#comandaItens').innerHTML = itens.length ? itens.map((i) => `
      <li>
        <span class="qtd">${i.quantidade}×</span>
        <span class="nome">${esc(i.produto)}<small>${dinheiro(i.preco_unitario)} cada</small></span>
        <span class="sub-item">${dinheiro(i.subtotal)}</span>
        <button class="btn-remover" data-produto="${i.id_produto}" aria-label="Remover ${esc(i.produto)}"><svg><use href="#i-x"/></svg></button>
      </li>`).join('')
    : '<li class="vazio">Nenhum item ainda. Escolha um produto ao lado.</li>';
  $$('#comandaItens .btn-remover').forEach((b) => {
    b.onclick = () => removerItem(Number(b.dataset.produto), b);
  });
  $('#btnFinalizar').disabled = itens.length === 0;

  estado.cardapioPedido = cardapio;
  renderizarSeletor();
}

// Grade de produtos para escolher (da view vw_cardapio)
function renderizarSeletor() {
  const cardapio = estado.cardapioPedido;
  const grupos = agruparPorCategoria(cardapio);
  renderizarAbas($('#filtroCategoriasPedido'), grupos, estado.categoriaPedido, (cat) => {
    estado.categoriaPedido = cat;
    renderizarSeletor();
  });

  // Busca por nome ou por código
  const busca = $('#buscaProduto').value.trim().toLowerCase();
  const filtrados = cardapio.filter((p) =>
    (!estado.categoriaPedido || p.categoria === estado.categoriaPedido) &&
    (p.produto.toLowerCase().includes(busca) || codigo(p.id_produto) === busca.padStart(2, '0')));

  // Se o produto selecionado esgotou (trigger de baixa), desmarca
  if (estado.produtoSel) {
    const atual = cardapio.find((p) => p.id_produto === estado.produtoSel.id_produto);
    if (!atual || atual.situacao === 'ESGOTADO') estado.produtoSel = null;
  }

  $('#seletorProdutos').innerHTML = filtrados.length ? filtrados.map((p) => `
    <button type="button" class="opcao ${estado.produtoSel?.id_produto === p.id_produto ? 'selecionada' : ''}"
            data-id="${p.id_produto}" ${p.situacao === 'ESGOTADO' ? 'disabled' : ''}>
      <span class="codigo">CÓD. ${codigo(p.id_produto)}</span>
      ${iconeCategoria(p.categoria)}
      <strong>${esc(p.produto)}</strong>
      <span class="opcao-rodape">
        <span class="opcao-preco">${dinheiro(p.preco)}</span>
        ${p.situacao === 'ESGOTADO' ? '<span class="aviso">Esgotado</span>' : p.situacao === 'REPOR' ? '<span class="aviso">Últimas</span>' : ''}
      </span>
    </button>`).join('')
    : '<div class="vazio" style="grid-column:1/-1">Nenhum produto encontrado.</div>';

  $$('#seletorProdutos .opcao').forEach((b) => {
    b.onclick = () => {
      // Trocou de produto: a quantidade volta para 1
      if (estado.produtoSel?.id_produto !== Number(b.dataset.id)) $('#qtd').value = 1;
      estado.produtoSel = cardapio.find((p) => p.id_produto === Number(b.dataset.id));
      $$('#seletorProdutos .opcao').forEach((o) => o.classList.toggle('selecionada', o === b));
      atualizarBarraAdicionar();
    };
  });
  atualizarBarraAdicionar();
}

function atualizarBarraAdicionar() {
  $('#produtoSelecionado').textContent = estado.produtoSel ? estado.produtoSel.produto : 'Toque em um produto';
  $('#btnAdicionar').disabled = !estado.produtoSel;
}

// --- Abrir pedido: CALL sp_abrir_pedido
async function abrirPedido() {
  if (!estado.clienteSel || !estado.funcionarioSel) {
    mostrarMensagem('Escolha o cliente e o atendente para abrir o pedido.', 'erro');
    return;
  }
  const r = await executar(
    () => API.abrirPedido(estado.clienteSel.id, estado.funcionarioSel.id), $('#btnAbrir'));
  if (!r) return;
  salvarPedido(r.id_pedido);
  estado.produtoSel = null;
  $('#qtd').value = 1;
  mostrarMensagem(`Pedido #${r.id_pedido} aberto. Agora adicione os produtos.`, 'ok');
  await carregarPedidoAtual();
}

// --- Adicionar item: CALL sp_adicionar_item
async function adicionarItem() {
  if (!estado.produtoSel) return;
  const quantidade = Number($('#qtd').value);
  const nome = estado.produtoSel.produto;
  const r = await executar(
    () => API.adicionarItem(estado.pedidoAtual, estado.produtoSel.id_produto, quantidade),
    $('#btnAdicionar'));
  if (r) {
    mostrarMensagem(`${quantidade}× ${nome} adicionado ao pedido.`, 'ok');
    $('#qtd').value = 1;
  }
  await carregarPedidoAtual(); // estoque e situação mudaram pelo trigger
}

// --- Remover item: DELETE em item_pedido (o trigger devolve o estoque)
async function removerItem(idProduto, botao) {
  const r = await executar(() => API.removerItem(estado.pedidoAtual, idProduto), botao);
  if (r) mostrarMensagem('Item removido e estoque devolvido.', 'ok');
  await carregarPedidoAtual();
}

// --- Finalizar: CALL sp_finalizar_pedido e exibe o desconto e o total
async function finalizarPedido() {
  const pedido = await executar(() => API.finalizarPedido(estado.pedidoAtual), $('#btnFinalizar'));
  if (!pedido) { await carregarPedidoAtual(); return; }

  salvarPedido(null);
  $('#reciboTitulo').textContent = `Pedido #${pedido.id_pedido}`;
  $('#reciboCliente').textContent = pedido.cliente;
  $('#reciboBruto').textContent = dinheiro(pedido.valor_bruto);
  $('#reciboDesconto').textContent = Number(pedido.desconto_percentual) > 0
    ? percentual(pedido.desconto_percentual)
    : 'sem desconto';
  $('#reciboTotal').textContent = dinheiro(pedido.valor_total);
  mostrarPasso('recibo');
  mostrarMensagem(`Pedido #${pedido.id_pedido} pago. Total: ${dinheiro(pedido.valor_total)}.`, 'ok');
}

// --- Volta ao passo 1 limpando as escolhas
function novoPedido() {
  estado.clienteSel = null;
  estado.funcionarioSel = null;
  $$('.pessoa').forEach((p) => p.classList.remove('selecionada'));
  atualizarResumoAbrir();
  mostrarPasso('abrir');
}

// --- Retomar um pedido aberto a partir da tela de pedidos
function continuarPedido(id) {
  salvarPedido(id);
  estado.produtoSel = null;
  irPara('novo');
}

// =====================================================================
// TELA 3 — PEDIDOS (vw_pedidos_detalhados)
// =====================================================================
async function carregarPedidos() {
  const dados = await executar(() => Promise.all([
    API.listarPedidos(estado.statusFiltro),
    API.listarPedidos('') // só para mostrar a quantidade em cada filtro
  ]));
  if (!dados) return;
  const [linhas, todos] = dados;

  const qtd = (s) => (s ? todos.filter((p) => p.status === s).length : todos.length);
  $$('#filtroStatus .seg').forEach((b) => {
    b.classList.toggle('ativo', b.dataset.status === estado.statusFiltro);
    const nome = { '': 'Todos', ABERTO: 'Abertos', PAGO: 'Pagos', CANCELADO: 'Cancelados' }[b.dataset.status];
    b.innerHTML = `${nome} <span class="qtd">${qtd(b.dataset.status)}</span>`;
  });

  $('#pedidosCorpo').innerHTML = linhas.length ? linhas.map((p) => {
    const dh = dataHora(p.data_pedido);
    return `
    <tr>
      <td><span class="num-pedido">#${p.id_pedido}</span></td>
      <td class="data" data-rot="Data">${dh.data} <small>${dh.hora}</small></td>
      <td class="c-status"><span class="selo selo-${p.status}">${p.status}</span></td>
      <td class="forte" data-rot="Cliente">${esc(p.cliente)}</td>
      <td data-rot="Atendente">${esc(p.atendente)}</td>
      <td class="num c-celular-ocultar">${p.qtd_itens}</td>
      <td class="num" data-rot="Bruto">${dinheiro(p.valor_bruto)}</td>
      <td class="num c-celular-ocultar">${percentual(p.desconto_percentual)}</td>
      <td class="num c-total forte">${p.status === 'PAGO' ? dinheiro(p.valor_total) : '—'}</td>
      <td class="c-acao">${p.status === 'ABERTO'
        ? `<button class="btn-mini" data-continuar="${p.id_pedido}">Continuar pedido</button>` : ''}</td>
    </tr>`;
  }).join('')
    : '<tr><td colspan="10" class="vazio">Nenhum pedido com esse status.</td></tr>';

  $$('[data-continuar]').forEach((b) => {
    b.onclick = () => continuarPedido(Number(b.dataset.continuar));
  });
}

// =====================================================================
// TELA 4 — GERÊNCIA
// =====================================================================
async function carregarGerencia() {
  const dados = await executar(() => Promise.all([
    API.listarProdutosParaRepor(),
    API.listarVendasPorCategoria(),
    API.listarHistoricoPrecos(),
    API.listarCategorias()
  ]));
  if (!dados) return;
  const [repor, vendas, historico, categorias] = dados;

  // Produtos para repor (vw_produtos_para_repor)
  const contador = $('#contadorRepor');
  contador.textContent = repor.length ? `${repor.length} ${repor.length === 1 ? 'item' : 'itens'}` : 'Tudo em dia';
  contador.classList.toggle('zero', !repor.length);
  $('#listaRepor').innerHTML = repor.length ? repor.map((p) => `
    <div class="repor-item">
      ${iconeCategoria(p.categoria)}
      <div>
        <strong>${esc(p.produto)}</strong>
        <div class="repor-medidor ${p.estoque === 0 ? 'zero' : ''}">
          <span style="width:${p.estoque_minimo ? Math.min(100, (p.estoque / p.estoque_minimo) * 100) : 0}%"></span>
        </div>
        <div class="repor-texto">${p.estoque} em estoque · mínimo ${p.estoque_minimo}</div>
      </div>
      <div class="repor-faltam"><b>${p.faltam}</b><span>faltam</span></div>
    </div>`).join('')
    : '<div class="vazio">Nada para repor. Estoque em dia!</div>';

  // Vendas por categoria (vw_vendas_por_categoria): barras proporcionais
  const maior = Math.max(...vendas.map((v) => Number(v.faturamento)), 0) || 1;
  $('#vendasGrafico').innerHTML = vendas.map((v) => `
    <div class="barra-linha" data-cat="${slugCategoria(v.categoria)}">
      <span class="cat"><i></i>${esc(v.categoria)}</span>
      <div class="barra-trilho">
        <div class="barra-cheia" style="width:${(Number(v.faturamento) / maior) * 58}%"></div>
        <span class="barra-valor">${dinheiro(v.faturamento)}<small>${v.unidades} un.</small></span>
      </div>
    </div>`).join('');

  // Categorias do reajuste (chips)
  if (!estado.categoriaReajuste && categorias.length) estado.categoriaReajuste = categorias[0];
  $('#opcoesCategoria').innerHTML = categorias.map((c) => `
    <button type="button" class="aba ${estado.categoriaReajuste?.id_categoria === c.id_categoria ? 'ativo' : ''}"
            data-id="${c.id_categoria}" data-cat="${slugCategoria(c.nome)}">
      <svg><use href="#c-${slugCategoria(c.nome) || 'cafes'}"/></svg>${esc(c.nome)}
    </button>`).join('');
  $$('#opcoesCategoria .aba').forEach((b) => {
    b.onclick = () => {
      estado.categoriaReajuste = categorias.find((c) => c.id_categoria === Number(b.dataset.id));
      $$('#opcoesCategoria .aba').forEach((o) => o.classList.toggle('ativo', o === b));
      esconderConfirmacao();
    };
  });

  // Histórico de preços (historico_preco, preenchido pelo trigger)
  $('#listaHistorico').innerHTML = historico.length ? historico.map((h) => {
    const sobe = Number(h.preco_novo) > Number(h.preco_antigo);
    const dh = dataHora(h.data_alteracao);
    return `
    <div class="hist-item">
      <span class="hist-seta ${sobe ? 'sobe' : 'desce'}"><svg><use href="#${sobe ? 'i-seta-cima' : 'i-seta-baixo'}"/></svg></span>
      <div><strong>${esc(h.produto)}</strong><small>${dh.data} ${dh.hora} · ${esc(h.usuario)}</small></div>
      <div class="hist-precos"><s>${dinheiro(h.preco_antigo)}</s><b>${dinheiro(h.preco_novo)}</b></div>
    </div>`;
  }).join('')
    : '<div class="vazio">Nenhuma alteração de preço registrada.</div>';
}

// --- Reajuste em duas etapas: pedir confirmação na própria tela
function pedirConfirmacaoReajuste(ev) {
  ev.preventDefault();
  const pct = $('#percentual').value;
  if (!estado.categoriaReajuste || pct === '') {
    mostrarMensagem('Escolha a categoria e informe o percentual do reajuste.', 'erro');
    return;
  }
  const sinal = Number(pct) > 0 ? '+' : '';
  $('#textoConfirmacao').textContent =
    `Aplicar ${sinal}${pct}% em todos os produtos de "${estado.categoriaReajuste.nome}"?`;
  $('#confirmacao').hidden = false;
  $('#btnReajustar').hidden = true;
}
function esconderConfirmacao() {
  $('#confirmacao').hidden = true;
  $('#btnReajustar').hidden = false;
}

// --- CALL sp_reajustar_precos_categoria
async function reajustarPrecos() {
  const cat = estado.categoriaReajuste;
  const pct = $('#percentual').value;
  const r = await executar(() => API.reajustarPrecos(cat.id_categoria, Number(pct)), $('#btnConfirmarReajuste'));
  esconderConfirmacao();
  if (r) {
    mostrarMensagem(`Preços de "${cat.nome}" reajustados em ${pct}%. O histórico foi registrado pelo banco.`, 'ok');
    $('#percentual').value = '';
  }
  await carregarGerencia();
}

// =====================================================================
// EVENTOS
// =====================================================================
$$('.nav-btn').forEach((b) => { b.onclick = () => irPara(b.dataset.tela); });

$('#btnAbrir').onclick = abrirPedido;
$('#btnAdicionar').onclick = adicionarItem;
$('#btnFinalizar').onclick = finalizarPedido;
$('#btnNovoDeNovo').onclick = novoPedido;
$('#btnSairPedido').onclick = () => {
  mostrarMensagem(`Pedido #${estado.pedidoAtual} continua ABERTO. Ele pode ser retomado na tela Pedidos.`, 'ok');
  salvarPedido(null);
  novoPedido();
};

$('#qtdMenos').onclick = () => { $('#qtd').value = Math.max(1, Number($('#qtd').value) - 1); };
$('#qtdMais').onclick = () => { $('#qtd').value = Number($('#qtd').value) + 1; };
$('#buscaProduto').oninput = () => renderizarSeletor();

$$('#filtroStatus .seg').forEach((b) => {
  b.onclick = () => { estado.statusFiltro = b.dataset.status; carregarPedidos(); };
});

$('#formReajuste').onsubmit = pedirConfirmacaoReajuste;
$('#btnCancelarReajuste').onclick = esconderConfirmacao;
$('#btnConfirmarReajuste').onclick = reajustarPrecos;
$$('.atalho').forEach((b) => {
  b.onclick = () => { $('#percentual').value = b.dataset.pct; esconderConfirmacao(); };
});

// Início
salvarPedido(estado.pedidoAtual);
carregarCardapio();
