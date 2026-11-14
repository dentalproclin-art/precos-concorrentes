// Preços Proclin: mostra no VendAi os preços dos concorrentes (arquivo público, sem custo nem margem).
// 1) No pedido/cotação: etiqueta embaixo de cada produto com o menor concorrente.
// 2) Em "Detalhes do produto" e no cadastro do produto: quadro "Concorrentes" com todas as lojas, link e o botão "corrigir".
(() => {
  let D = null, ultimoCodigo = null, porId = null;
  const brl = v => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = t => { const m = String(t || '').match(/R\$\s*([\d.]+,\d{2})/); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null; };
  const CODIGO = /^\s*(?:001\.)?(\d{6}(?:-\d{1,2})?)(?:\.01)?\s*$/;

  function carregar(forcar) {
    chrome.runtime.sendMessage({ tipo: 'precos', forcar }, d => {
      if (!d || !d.p) return; D = d; porId = {};
      for (const [c, x] of Object.entries(D.p)) if (x.id) porId[x.id] = c;
      varrer();
    });
  }
  // menor concorrente válido (os links "em revisão" não contam)
  const menor = x => (x.c || []).find(c => !c[4]);

  function etiqueta(c, nosso) {
    const x = D.p[c]; if (!x) return null;
    const m = menor(x), el = document.createElement('div'); el.className = 'pp-tag';
    if (!m) { el.textContent = '🏷️ sem preço de concorrente'; el.classList.add('pp-cinza'); return el; }
    const p = nosso || x.pn;
    if (p && p <= m[1] + 0.005) { el.textContent = '🏷️ somos os mais baratos (menor: ' + brl(m[1]) + ' ' + m[0] + ')'; el.classList.add('pp-verde'); }
    else { el.textContent = '🏷️ menor: ' + brl(m[1]) + ' (' + m[0] + ')' + (p ? ' · estamos ' + Math.round((p / m[1] - 1) * 100) + '% acima' : ''); el.classList.add('pp-vermelho'); }
    el.title = 'Clique para ver todos os concorrentes';
    el.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); quadro(c, nosso, true); });
    return el;
  }

  // Etiquetas nas linhas de produto (pedido, cotação, listas)
  function etiquetarLinhas() {
    document.querySelectorAll('tr').forEach(tr => {
      if (tr.dataset.ppFeito) return;
      const tds = [...tr.querySelectorAll('td')]; if (tds.length < 2) return;
      const i = tds.findIndex(td => CODIGO.test(td.innerText)); if (i < 0) return;
      const c = tds[i].innerText.match(CODIGO)[1]; if (!D.p[c]) return;
      tr.dataset.ppFeito = '1';
      const nosso = tds.map(td => num(td.innerText)).filter(v => v).pop() || null;
      // vai na célula do nome do produto (a vizinha com mais texto), não numa coluna estreita
      const viz = [tds[i - 1], tds[i + 1]].filter(td => td && !td.querySelector('input,select,button'));
      const alvo = viz.sort((a, b) => b.innerText.trim().length - a.innerText.trim().length)[0] || tds[i];
      const el = etiqueta(c, nosso); if (el) alvo.appendChild(el);
      tr.addEventListener('click', () => { ultimoCodigo = c; }, true);
    });
  }

  // Cartões de "Buscar Produtos" no pedido/orçamento ("Cód. Prod.: 001.136001.01")
  const CARTAO = /C[óo]d\.\s*Prod\.?:?\s*(?:001\.)?(\d{6}(?:-\d{1,2})?)(?:\.\d{2})?\b/;
  function etiquetarCartoes() {
    const conta = e => (e.textContent.match(/C[óo]d\.\s*Prod/g) || []).length;
    document.querySelectorAll('span, div, p').forEach(s => {
      if (s.childElementCount > 2 || !s.textContent.includes('Prod')) return;
      const k = s.textContent.match(CARTAO); if (!k || !D.p[k[1]]) return;
      if (s.parentElement && s.parentElement.childElementCount <= 2 && CARTAO.test(s.parentElement.textContent) && conta(s.parentElement) === 1 && s.parentElement.textContent.length < 160) return; // usa o pai
      // sobe até o cartão inteiro (o maior bloco que só tem este produto), sem pegar a busca ou a tabela
      let card = s;
      while (card.parentElement && card.parentElement !== document.body && conta(card.parentElement) === 1 &&
             !card.parentElement.querySelector('input, ng-select, table')) card = card.parentElement;
      if (card === s) return;
      if (card.dataset.ppC === k[1]) return;          // já etiquetado com este produto
      card.querySelectorAll('.pp-tag').forEach(t => t.remove());  // cartão reaproveitado para outro produto
      card.dataset.ppC = k[1];
      const pr = card.querySelector('.new-price') || card.querySelector('.price');
      const el = etiqueta(k[1], pr ? num(pr.textContent) : null); if (!el) return;
      s.after(el);                                    // logo abaixo da linha "Cód. Prod."
      card.addEventListener('click', () => { ultimoCodigo = k[1]; }, true);
    });
  }

  // Quadro "Concorrentes"
  function quadro(c, nosso, manual) {
    const x = D.p[c]; if (!x) return;
    let box = document.getElementById('pp-box');
    if (box && box.dataset.c === c) { if (manual) box.dataset.manual = '1'; return; }
    if (!box) { box = document.createElement('div'); box.id = 'pp-box'; document.body.appendChild(box); }
    box.dataset.c = c; box.dataset.manual = manual ? '1' : '';
    const p = nosso || x.pn, m = menor(x);
    const linhas = (x.c || []).map((k, j) => `<tr class="${k === m ? 'pp-melhor' : ''}${k[4] ? ' pp-rev' : ''}">
        <td>${esc(k[0])}${k[4] ? ' <span class="pp-aviso">⚠ link em revisão</span>' : ''}</td><td class="pp-r">${brl(k[1])}</td>
        <td>${k[2] ? `<a href="${esc(k[2])}" target="_blank" rel="noopener" title="Abrir a página na loja">↗</a>` : ''}</td>
        <td><button class="pp-lnk" data-j="${j}" title="O link está errado?">✎ corrigir</button></td></tr>`).join('');
    const dif = p && m ? (p / m[1] - 1) : null;
    const data = D.extraido ? D.extraido.split('-').reverse().join('/') : '';
    box.innerHTML = `<div class="pp-h"><b>💲 Concorrentes</b><span>${esc(c)} · preços de ${data}</span><button class="pp-x" title="Fechar">×</button></div>
      <div class="pp-n">${esc(x.n || '')}</div>
      <table>${linhas || '<tr><td colspan="4">Sem preço de concorrente para este produto.</td></tr>'}
      <tr class="pp-nosso"><td>Nosso preço</td><td class="pp-r">${brl(p)}</td><td></td><td></td></tr></table>
      ${dif != null ? `<div class="${dif > 0.005 ? 'pp-alerta' : 'pp-ok'}">${dif > 0.005 ? 'Estamos <b>' + Math.round(dif * 100) + '% acima</b> do menor concorrente.' : 'Somos o menor preço.'}</div>` : ''}
      ${x.cf ? `<div class="pp-cf">⚠ ${esc(x.cf)}</div>` : ''}
      <div class="pp-form" hidden></div>`;
    box.querySelector('.pp-x').onclick = () => box.remove();
    box.querySelectorAll('.pp-lnk').forEach(b => b.onclick = () => formulario(box, c, x, x.c[Number(b.dataset.j)]));
  }

  function formulario(box, c, x, k) {
    const f = box.querySelector('.pp-form'); f.hidden = false;
    chrome.storage.local.get('vendedor', s => {
      f.innerHTML = `<b>Link da ${esc(k[0])} está errado?</b>
        <label><input type="radio" name="pp-prob" value="outro produto" checked> É outro produto (cor, tamanho ou quantidade diferente)</label>
        <label><input type="radio" name="pp-prob" value="loja não vende mais"> A loja não vende mais</label>
        <input class="pp-in" id="pp-certo" placeholder="Link certo (se souber)">
        <input class="pp-in" id="pp-obs" placeholder="Observação (ex.: na loja é kit com 5)">
        <input class="pp-in" id="pp-vend" placeholder="Seu nome" value="${esc(s.vendedor || '')}">
        <div class="pp-bts"><button class="pp-bt2" id="pp-cancel">Cancelar</button><button class="pp-bt" id="pp-env">Enviar para a Renata</button></div><div id="pp-msg"></div>`;
      f.querySelector('#pp-cancel').onclick = () => { f.hidden = true; };
      f.querySelector('#pp-env').onclick = () => {
        const vend = f.querySelector('#pp-vend').value.trim();
        if (!vend) { f.querySelector('#pp-msg').textContent = 'Coloque seu nome.'; return; }
        chrome.storage.local.set({ vendedor: vend });
        f.querySelector('#pp-env').disabled = true;
        chrome.runtime.sendMessage({ tipo: 'corrigir', c, n: x.n, loja: k[0], atual: k[2], problema: f.querySelector('input[name=pp-prob]:checked').value,
          certo: f.querySelector('#pp-certo').value.trim(), obs: f.querySelector('#pp-obs').value.trim(), vendedor: vend }, r => {
          f.innerHTML = r && r.ok ? '✅ Enviado. A Renata vai conferir; até lá use esse preço com cuidado.' : '❌ Não foi possível enviar. Tente de novo.';
        });
      };
    });
  }

  // Abre o quadro automaticamente em "Detalhes do produto" e no cadastro do produto
  function quadroAutomatico() {
    const box = document.getElementById('pp-box');
    const det = [...document.querySelectorAll('h1,h2,h3,h4,h5,.modal-title,span,div')].find(e => e.childElementCount === 0 && /^\s*Detalhes do produto\s*$/.test(e.textContent));
    const idCad = location.pathname.includes('/productPanel/createOrEdit') ? new URLSearchParams(location.search).get('id') : null;
    let c = null;
    if (idCad && porId && porId[idCad]) c = porId[idCad];
    else if (det) {
      const painel = det.closest('[role=dialog],.offcanvas,.modal,aside,div') || document.body;
      const achado = (painel.innerText.match(/\b(\d{6}(?:-\d{1,2})?)\b/g) || []).find(k => D.p[k]);
      c = achado || ultimoCodigo;
    }
    if (c && D.p[c]) quadro(c, null);
    else if (box && !det && !idCad && !box.dataset.manual) box.remove();  // aberto pela etiqueta: só fecha no ×
  }

  function varrer() { if (!D) return; etiquetarLinhas(); etiquetarCartoes(); quadroAutomatico(); }
  let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(varrer, 600); }).observe(document.body, { childList: true, subtree: true });
  carregar(false);
})();
