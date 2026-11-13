// Busca o arquivo de preços (atualizado todo dia pela rotina da Proclin) e guarda por 1 hora.
const URL_PRECOS = 'https://raw.githubusercontent.com/dentalproclin-art/precos-concorrentes/main/precos.json';
const FORM = 'https://submit.jotform.com/submit/263167113410042';
async function precos(forcar) {
  const c = await chrome.storage.local.get(['precos', 'em']);
  if (!forcar && c.precos && Date.now() - (c.em || 0) < 3600e3) return c.precos;
  try {
    const r = await fetch(URL_PRECOS + '?t=' + Math.floor(Date.now() / 3600e3), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    await chrome.storage.local.set({ precos: d, em: Date.now() });
    return d;
  } catch (e) { return c.precos || null; }
}
chrome.runtime.onMessage.addListener((m, _s, responder) => {
  if (m.tipo === 'precos') { precos(m.forcar).then(responder); return true; }
  if (m.tipo === 'corrigir') {
    const f = new URLSearchParams({ formID: '263167113410042', q2_q2_textbox0: m.c, q3_q3_textbox1: m.n || '', q4_q4_textbox2: m.loja,
      q5_q5_textbox3: m.atual || '', q6_q6_radio4: m.problema, q7_q7_textbox5: m.certo || '', q8_q8_textarea6: m.obs || '', q9_q9_textbox7: m.vendedor || '' });
    fetch(FORM, { method: 'POST', body: f }).then(r => responder({ ok: r.ok || r.type === 'opaque' })).catch(() => responder({ ok: false }));
    return true;
  }
});
