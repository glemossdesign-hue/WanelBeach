'use strict';

/* ===== QUADRAS =====
   Para adicionar uma quadra, inclua um item nesta lista. Exemplo:
   { nome: 'Quadra 1', modalidades: ['Vôlei de Praia', 'Futevôlei'], info: 'Texto', imagem: 'assets/images/quadra1.jpg' }
   A lista está vazia de propósito: a quantidade real de quadras ainda não foi informada. */
const COURTS = [];

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
      <div class="ph ph-sand card-img" ${c.imagem ? `style="background-image:url('${esc(c.imagem)}')"` : ''}></div>
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

/* Horários demonstrativos (serão substituídos pelos reais via Supabase) */
$('#fTime').innerHTML += Array.from({ length: 14 }, (_, i) => `<option>${String(i + 8).padStart(2, '0')}:00</option>`).join('');

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
  const fields = ['#fSport', '#fCourt', '#fDate', '#fTime'].map($);
  fields.forEach((f) => f.classList.toggle('err', !f.value));
  if (fields.some((f) => !f.value)) {
    msg.textContent = COURTS.length ? 'Preencha todos os campos para consultar.' : 'Preencha os campos. A escolha de quadra ficará disponível quando as quadras forem cadastradas.';
    return;
  }
  msg.textContent = 'Demonstração: a consulta real de disponibilidade será ativada na integração com o Supabase. Nenhuma reserva foi feita.';
});
document.querySelectorAll('#bookingForm select,#bookingForm input').forEach((f) => f.addEventListener('change', () => f.classList.remove('err')));

/* Animação de entrada */
const io = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

$('#year').textContent = new Date().getFullYear();
