'use strict';

/* ===== QUADRAS =====
   Para adicionar uma quadra, inclua um item nesta lista. Exemplo:
   { nome: 'Quadra 1', modalidades: ['Vôlei de Praia', 'Futevôlei'], info: 'Texto', imagem: 'quadra-1.jpg' }  (a foto fica em assets/images/quadras/)
   Pode ter qualquer quantidade de itens: os cards e o seletor da reserva se ajustam sozinhos.
   Hoje são 5 quadras (informado pelo Wanel Beach). Os nomes "Quadra 1" a "Quadra 5" são provisórios e as modalidades de cada uma ainda não foram informadas. */
const PRICE_PER_HOUR = 90; // informado pelo Wanel Beach
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const COURTS = [
  { nome: 'Quadra 1', info: `${brl(PRICE_PER_HOUR)} por hora` },
  { nome: 'Quadra 2', info: `${brl(PRICE_PER_HOUR)} por hora` },
  { nome: 'Quadra 3', info: `${brl(PRICE_PER_HOUR)} por hora` },
  { nome: 'Quadra 4', info: `${brl(PRICE_PER_HOUR)} por hora` },
  { nome: 'Quadra 5', info: `${brl(PRICE_PER_HOUR)} por hora` }
];

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
      <div class="photo card-img" data-ph="Foto da quadra em breve" ${c.imagem ? `data-src="assets/images/quadras/${esc(c.imagem)}"` : ''}></div>
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

/* Horários demonstrativos (serão substituídos pelos reais via Supabase). Várias horas podem ser escolhidas e o valor soma. */
const picked = new Set();
const chips = $('#fTimes'), sum = $('#sumTxt');
chips.innerHTML = Array.from({ length: 14 }, (_, i) => {
  const t = `${String(i + 8).padStart(2, '0')}:00`;
  return `<button type="button" class="chip" aria-pressed="false" data-t="${t}">${t}</button>`;
}).join('');
function updateSum() {
  const n = picked.size;
  sum.textContent = n ? `${n} ${n > 1 ? 'horas' : 'hora'} × ${brl(PRICE_PER_HOUR)} = ${brl(n * PRICE_PER_HOUR)}` : `${brl(PRICE_PER_HOUR)} por hora. Escolha uma ou mais horas.`;
}
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
updateSum();

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

/* Formulário (somente demonstração, sem reserva real) */
$('#bookingForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = $('#formMsg');
  const fields = ['#fSport', '#fCourt', '#fDate'].map($);
  fields.forEach((f) => f.classList.toggle('err', !f.value));
  chips.classList.toggle('err', !picked.size);
  if (fields.some((f) => !f.value) || !picked.size) {
    msg.textContent = 'Preencha modalidade, quadra, data e escolha ao menos um horário.';
    return;
  }
  msg.textContent = `Demonstração: ${picked.size} ${picked.size > 1 ? 'horas' : 'hora'}, total de ${brl(picked.size * PRICE_PER_HOUR)}. A consulta real de disponibilidade será ativada na integração com o Supabase. Nenhuma reserva foi feita.`;
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
  voleiDePraia: 'modalidades/volei-de-praia', futevolei: 'modalidades/futevolei',
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

$('#year').textContent = new Date().getFullYear();
