'use strict';

/* ===== QUADRAS =====
   Para adicionar uma quadra, inclua um item nesta lista. Exemplo:
   { nome: 'Quadra 1', modalidades: ['Vôlei de Areia', 'Futevôlei'], info: 'Texto', imagem: 'quadra-1.jpg' }  (a foto fica em assets/images/quadras/)
   Pode ter qualquer quantidade de itens: os cards e o seletor da reserva se ajustam sozinhos.
   Hoje são 5 quadras (informado pelo Wanel Beach). Os nomes "Quadra 1" a "Quadra 5" são provisórios e as modalidades de cada uma ainda não foram informadas. */
const PRICE_PER_HOUR = 90; // informado pelo Wanel Beach
/* Horário de funcionamento informado pelo Wanel Beach (0 = domingo). O dado oficial ficará no Supabase. */
const OPEN_HOURS = { 0: ['08:00', '21:00'], 1: ['18:00', '23:00'], 2: ['18:00', '23:00'], 3: ['18:00', '23:00'], 4: ['18:00', '23:00'], 5: ['18:00', '23:00'], 6: ['08:00', '22:00'] };
const DAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let COURTS = [
  { nome: 'Quadra 1', info: `${brl(PRICE_PER_HOUR)} por hora` },
  { nome: 'Quadra 2', info: `${brl(PRICE_PER_HOUR)} por hora` },
  { nome: 'Quadra 3', info: `${brl(PRICE_PER_HOUR)} por hora` },
  { nome: 'Quadra 4', info: `${brl(PRICE_PER_HOUR)} por hora` },
  { nome: 'Quadra 5', info: `${brl(PRICE_PER_HOUR)} por hora` }
];

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ===== SUPABASE =====
   A URL e a chave "publishable" são públicas por natureza. NUNCA coloque aqui a chave "service_role" ou "secret". */
const SUPABASE_URL = 'https://doxwtmocmhyuwybnzllq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QqSLkPqB5EROP8CP3cYjmw_apX59S9H';
const PAYMENTS_READY = false; // mude para true quando o pagamento (Mercado Pago) estiver ativo
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
let LIVE = false, SPORTS = [], user = null;
const ERR = {
  slot_unavailable: 'Esse horário acabou de ser reservado. Escolha outro.', outside_operating_hours: 'Esse horário está fora do funcionamento.',
  slot_blocked: 'Esse horário está bloqueado.', booking_in_the_past: 'Esse horário já passou.', no_pricing_rule: 'O preço ainda não foi configurado.',
  invalid_duration: 'Duração inválida.', sport_unavailable: 'Modalidade indisponível.', sport_not_offered_on_court: 'Essa quadra não atende a modalidade.',
  court_unavailable: 'Quadra indisponível.', not_authenticated: 'Entre na sua conta para reservar.', too_far_in_advance: 'Ainda não abrimos reservas para essa data.'
};
const fail = (e) => { const m = String((e && e.message) || e); const k = Object.keys(ERR).find((x) => m.includes(x)); return k ? ERR[k] : 'Algo deu errado. Tente de novo em instantes.'; };

/* Menu: efeito ao rolar e menu hambúrguer */
const nav = $('#nav'), burger = $('#burger'), menu = $('#menu');
addEventListener('scroll', () => nav.classList.toggle('solid', scrollY > 60), { passive: true });
burger.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  burger.setAttribute('aria-expanded', open);
});
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
});

/* Quadras: monta os cards e o seletor da reserva */
const grid = $('#courtsGrid'), fCourt = $('#fCourt');
function renderCourts() {
  if (!COURTS.length) {
    grid.innerHTML = '<div class="court-empty reveal in">As quadras serão apresentadas aqui em breve.</div>';
    fCourt.innerHTML = '<option value="">Em breve</option>';
    return;
  }
  grid.innerHTML = COURTS.map((c) => `
    <article class="card reveal in">
      <div class="photo card-img" data-ph="Foto da quadra em breve" ${c.url ? `data-src="${esc(c.url)}"` : c.imagem ? `data-src="assets/images/quadras/${esc(c.imagem)}"` : ''}></div>
      <div class="card-body">
        <h3>${esc(c.nome)}</h3>
        <div class="tags">${(c.modalidades || []).map((m) => `<span>${esc(m)}</span>`).join('')}</div>
        <p>${esc(c.info || '')}</p>
        <button class="btn btn-blue" data-court="${esc(c.nome)}">Consultar horários</button>
      </div>
    </article>`).join('');
  fCourt.innerHTML = '<option value="">Escolha</option>' + COURTS.map((c) => `<option>${esc(c.nome)}</option>`).join('');
}
renderCourts();

/* Horários conforme o funcionamento informado (a disponibilidade real virá do Supabase). Várias horas podem ser escolhidas e o valor soma. */
const picked = new Set();
const chips = $('#fTimes'), sum = $('#sumTxt');
const prices = {};
async function renderChips() {
  picked.clear();
  Object.keys(prices).forEach((k) => delete prices[k]);
  const v = $('#fDate').value;
  if (!v) { chips.innerHTML = '<span class="hint">Escolha a data para ver os horários.</span>'; updateSum(); return; }
  if (LIVE) {
    if (!$('#fSport').value || !$('#fCourt').value) { chips.innerHTML = '<span class="hint">Escolha a modalidade e a quadra.</span>'; updateSum(); return; }
    chips.innerHTML = '<span class="hint">Consultando horários…</span>'; updateSum();
    const { data, error } = await sb.rpc('get_court_availability', { p_date: v, p_sport_id: $('#fSport').value });
    if (v !== $('#fDate').value) return;
    if (error) { chips.innerHTML = `<span class="hint">${esc(fail(error))}</span>`; return; }
    const slots = data.filter((s) => s.court_id === $('#fCourt').value);
    chips.innerHTML = slots.length ? slots.map((s) => {
      const t = s.start_time.slice(0, 5); prices[t] = Number(s.price);
      return `<button type="button" class="chip" data-t="${t}" aria-pressed="false" ${s.is_available ? '' : 'disabled'}>${t}</button>`;
    }).join('') : '<span class="hint">Sem horários neste dia.</span>';
    updateSum(); return;
  }
  const [open, close] = OPEN_HOURS[new Date(v + 'T12:00:00').getDay()];
  let html = '';
  for (let h = parseInt(open, 10); h < parseInt(close, 10); h++) { const t = `${String(h).padStart(2, '0')}:00`; html += `<button type="button" class="chip" aria-pressed="false" data-t="${t}">${t}</button>`; }
  chips.innerHTML = html; updateSum();
}
function updateSum() {
  const n = picked.size;
  const total = [...picked].reduce((s, t) => s + (prices[t] ?? PRICE_PER_HOUR), 0);
  sum.textContent = n ? `${n} ${n > 1 ? 'horas' : 'hora'} · ${brl(total)}` : `${brl(PRICE_PER_HOUR)} por hora. Escolha uma ou mais horas seguidas.`;
}
function fillCourts() {
  const s = $('#fSport').value;
  const list = LIVE && s ? COURTS.filter((c) => c.sportIds.includes(s)) : COURTS;
  fCourt.innerHTML = list.length ? '<option value="">Escolha</option>' + list.map((c) => `<option value="${esc(LIVE ? c.id : c.nome)}">${esc(c.nome)}</option>`).join('') : '<option value="">Em breve</option>';
}
$('#fSport').addEventListener('change', () => { fillCourts(); renderChips(); });
fCourt.addEventListener('change', renderChips);
chips.addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  const on = !picked.has(b.dataset.t);
  if (on) picked.add(b.dataset.t); else picked.delete(b.dataset.t);
  b.setAttribute('aria-pressed', on);
  b.classList.toggle('on', on);
  chips.classList.remove('err');
  updateSum();
});
renderChips();
$('#fDate').addEventListener('change', renderChips);

/* Data mínima = hoje */
const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
$('#fDate').min = today.toISOString().slice(0, 10);

/* Botões "Agendar horário" / "Consultar horários" */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sport],[data-court]');
  if (!b) return;
  if (b.dataset.sport) $('#fSport').value = b.dataset.sport;
  if (b.dataset.court) fCourt.value = b.dataset.court;
  $('#reserva').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

/* Formulário de reserva */
$('#bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#formMsg');
  const fields = ['#fSport', '#fCourt', '#fDate'].map($);
  fields.forEach((f) => f.classList.toggle('err', !f.value));
  chips.classList.toggle('err', !picked.size);
  if (fields.some((f) => !f.value) || !picked.size) { msg.textContent = 'Preencha modalidade, quadra, data e escolha ao menos um horário.'; return; }
  const times = [...picked].sort(), hrs = times.map((t) => parseInt(t, 10));
  if (hrs.some((h, i) => i && h !== hrs[i - 1] + 1)) { msg.textContent = 'Escolha horas seguidas, sem pular horários.'; return; }
  const total = times.reduce((s, t) => s + (prices[t] ?? PRICE_PER_HOUR), 0);
  if (!LIVE) { msg.textContent = `Demonstração: ${times.length} h, total de ${brl(total)}. Nenhuma reserva foi feita.`; return; }
  if (!PAYMENTS_READY) { msg.innerHTML = 'As reservas online abrem em breve. Para reservar agora, fale no <a class="link" target="_blank" rel="noopener" href="https://wa.me/5515991963030">WhatsApp</a>.'; return; }
  if (!user) { msg.textContent = 'Entre ou crie sua conta para reservar.'; openAuth('login'); return; }
  msg.textContent = 'Reservando…';
  const { data, error } = await sb.rpc('create_booking', { p_court_id: $('#fCourt').value, p_sport_id: $('#fSport').value, p_booking_date: $('#fDate').value, p_start_time: times[0], p_duration_minutes: times.length * 60 });
  if (error) { msg.textContent = fail(error); renderChips(); return; }
  const until = new Date(data.hold_expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  msg.textContent = `Horário guardado para você até ${until}. Total: ${brl(Number(data.total_price))}. Falta só o pagamento.`;
  renderChips();
});
document.querySelectorAll('#bookingForm select,#bookingForm input').forEach((f) => f.addEventListener('change', () => f.classList.remove('err')));

/* Animação de entrada */
const io = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ===== FOTOS REAIS =====
   Coloque os arquivos nas pastas de assets/images (veja assets/images/LEIA-ME.txt), em .jpg ou .webp.
   Sem arquivo, o espaço reservado elegante continua visível. */
const IMG_BASE = 'assets/images/';
const IMAGES = {
  hero: 'hero/hero', espaco: 'espaco/espaco',
  voleiDeAreia: 'modalidades/volei-de-areia', beachTenis: 'modalidades/beach-tenis', futevolei: 'modalidades/futevolei',
  mosaico1: 'experiencia/jogos', mosaico2: 'experiencia/estrutura', mosaico3: 'experiencia/amigos',
  mosaico4: 'experiencia/ambiente', mosaico5: 'experiencia/eventos',
  instagram1: 'instagram/post-1', instagram2: 'instagram/post-2', instagram3: 'instagram/post-3',
  instagram4: 'instagram/post-4', instagram5: 'instagram/post-5', instagram6: 'instagram/post-6'
};
const EXTS = ['jpg', 'webp'];
function updateNotes() {
  document.querySelectorAll('[data-pending]').forEach((n) => {
    n.hidden = !n.closest('section').querySelector('.photo:not(.has-photo)');
  });
}
function loadPhoto(el) {
  if (!el.dataset.ph) el.dataset.ph = 'Foto em breve';
  const list = el.dataset.src ? [el.dataset.src]
    : IMAGES[el.dataset.img] ? EXTS.map((x) => `${IMG_BASE}${IMAGES[el.dataset.img]}.${x}`) : [];
  (function next(i) {
    if (i >= list.length) return;
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url("${img.src}")`; el.classList.add('has-photo'); updateNotes(); };
    img.onerror = () => next(i + 1);
    img.src = list[i];
  })(0);
}
document.querySelectorAll('.photo').forEach(loadPhoto);

/* Horário de funcionamento na seção Localização */
$('#hoursList').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => `<li><span>${DAY_NAMES[d]}</span><b>${OPEN_HOURS[d][0]}–${OPEN_HOURS[d][1]}</b></li>`).join('');

/* ===== CATÁLOGO DO BANCO ===== */
async function loadCatalog() {
  if (!sb) return;
  try {
    const [s, c] = await Promise.all([
      sb.from('sports').select('id,name,slug').order('name'),
      sb.from('courts').select('id,name,description,image_url,court_sports(sport_id)').order('name')
    ]);
    if (s.error || c.error) throw (s.error || c.error);
    SPORTS = s.data;
    COURTS = c.data.map((x) => ({
      id: x.id, nome: x.name, url: x.image_url, sportIds: x.court_sports.map((y) => y.sport_id),
      info: `${brl(PRICE_PER_HOUR)} por hora${x.description ? ' · ' + x.description : ''}`,
      modalidades: x.court_sports.map((y) => (SPORTS.find((z) => z.id === y.sport_id) || {}).name).filter(Boolean)
    }));
    LIVE = true;
    $('#fSport').innerHTML = '<option value="">Escolha</option>' + SPORTS.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    renderCourts(); fillCourts(); renderChips();
    $('#authBtn').hidden = false;
    document.querySelectorAll('.photo').forEach(loadPhoto);
  } catch (e) { /* sem conexão com o banco: continua em modo demonstração */ }
}

/* ===== CONTA DO CLIENTE ===== */
const dlg = $('#authDlg'), aMsg = $('#authMsg');
let mode = 'login';
function setMode(m) {
  mode = m; aMsg.textContent = '';
  $('#authTitle').textContent = { login: 'Entrar', signup: 'Criar conta', reset: 'Nova senha' }[m];
  $('#aSubmit').textContent = { login: 'Entrar', signup: 'Criar conta', reset: 'Salvar nova senha' }[m];
  $('#aName').hidden = $('#aPhone').hidden = m !== 'signup';
  $('#aEmail').hidden = $('#aForgot').hidden = m === 'reset';
  $('#authTabs').hidden = m === 'reset';
  $('#aPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  document.querySelectorAll('#authTabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
}
async function loadMine() {
  const { data, error } = await sb.rpc('get_my_bookings');
  const L = { pending_payment: 'aguardando pagamento', confirmed: 'confirmada', cancelled: 'cancelada', expired: 'expirada' };
  $('#myList').innerHTML = error ? '<li>Não foi possível carregar.</li>' : data.length ? data.map((b) =>
    `<li><b>${esc(b.court_name)}</b> · ${esc(b.sport_name)}<br>${esc(b.booking_date.split('-').reverse().join('/'))} · ${esc(b.start_time.slice(0, 5))}–${esc(b.end_time.slice(0, 5))}<br><small>${L[b.status] || esc(b.status)} · ${brl(Number(b.total_price))}</small></li>`).join('') : '<li>Você ainda não tem reservas.</li>';
}
function renderAuth() {
  $('#authOut').hidden = !!user && mode !== 'reset'; $('#authIn').hidden = !user || mode === 'reset';
  if (user && mode !== 'reset') loadMine();
}
function openAuth(m) { if (!dlg.open) { setMode(user ? 'login' : m || 'login'); renderAuth(); dlg.showModal(); } }
if (sb) {
  $('#authBtn').addEventListener('click', () => openAuth('login'));
  $('#authClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('#authTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
  $('#logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); dlg.close(); });
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault(); aMsg.textContent = '';
    const email = $('#aEmail').value.trim(), password = $('#aPass').value;
    if (password.length < 8 || (mode !== 'reset' && !email)) { aMsg.textContent = 'Informe e-mail e uma senha de pelo menos 8 caracteres.'; return; }
    let r;
    if (mode === 'reset') {
      r = await sb.auth.updateUser({ password });
      if (!r.error) { mode = 'login'; aMsg.textContent = 'Senha atualizada!'; renderAuth(); return; }
    } else if (mode === 'signup') {
      const name = $('#aName').value.trim();
      if (name.length < 3) { aMsg.textContent = 'Informe seu nome completo.'; return; }
      r = await sb.auth.signUp({ email, password, options: { data: { full_name: name, phone: $('#aPhone').value.trim() }, emailRedirectTo: location.origin + location.pathname } });
      if (!r.error && !r.data.session) { aMsg.textContent = 'Conta criada! Confirme seu e-mail para entrar.'; return; }
    } else r = await sb.auth.signInWithPassword({ email, password });
    if (r.error) aMsg.textContent = /invalid login/i.test(r.error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível concluir. Confira os dados.';
  });
  $('#aForgot').addEventListener('click', async () => {
    const email = $('#aEmail').value.trim();
    if (!email) { aMsg.textContent = 'Digite seu e-mail acima.'; return; }
    await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    aMsg.textContent = 'Se o e-mail existir, enviamos o link para criar uma nova senha.';
  });
  sb.auth.onAuthStateChange((ev, s) => {
    user = s ? s.user : null;
    setTimeout(() => {
      $('#authBtn').textContent = user ? 'Minha conta' : 'Entrar';
      if (ev === 'PASSWORD_RECOVERY') { setMode('reset'); renderAuth(); if (!dlg.open) dlg.showModal(); }
      else if (dlg.open && (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT')) { setMode('login'); renderAuth(); }
    }, 0);
  });
}
loadCatalog();

$('#year').textContent = new Date().getFullYear();
