/* ============================================================================
   RentaMaq · Planes y precios
   ----------------------------------------------------------------------------
   Tres planes de referencia para proveedores y contratistas. La información es
   parte de la interfaz estática; la activación se coordina desde Soporte.
   ========================================================================== */

'use strict';

const PLANES = [
  {
    id: 'gratis',
    kicker: 'PARA EMPEZAR',
    name: 'Gratis',
    price: '0',
    period: 'para siempre · comisión 15%',
    featured: false,
    cta: 'Empezar gratis',
    route: 'catalogo',
    provider: ['1 equipo publicado', '3 solicitudes / mes'],
    contractor: ['Buscar y comparar', 'Reservar sin costo']
  },
  {
    id: 'basico',
    kicker: 'PARA PROFESIONALES',
    name: 'Básico · Plus',
    price: '19',
    period: 'al mes · comisión 12%',
    featured: true,
    cta: 'Elegir Básico',
    route: 'soporte',
    provider: ['10 equipos publicados', 'Insignia Verificado', '15 solicitudes / mes'],
    contractor: ['Reserva prioritaria', 'Historial de alquileres']
  },
  {
    id: 'pro',
    kicker: 'PARA ESCALAR',
    name: 'Pro',
    price: '49',
    period: 'al mes · comisión 8%',
    featured: false,
    cta: 'Elegir Pro',
    route: 'soporte',
    provider: ['Equipos ilimitados', 'Posición destacada', 'Resúmenes de ventas'],
    contractor: ['Entrega prioritaria en obra', 'Soporte técnico 24/7']
  }
];

function planCard(plan) {
  return `
    <article class="plan-card ${plan.featured ? 'featured' : ''}" id="plan-${plan.id}">
      ${plan.featured ? '<span class="plan-badge">RECOMENDADO</span>' : ''}
      <div class="plan-kicker">${plan.kicker}</div>
      <h2>${plan.name}</h2>
      <div class="plan-price"><strong>S/ ${plan.price}</strong><span>${plan.period}</span></div>
      <div class="plan-section">
        <h4>PROVEEDOR</h4>
        <ul class="plan-features">${plan.provider.map((feature) => `<li>${feature}</li>`).join('')}</ul>
      </div>
      <div class="plan-section">
        <h4>CONTRATISTA</h4>
        <ul class="plan-features">${plan.contractor.map((feature) => `<li>${feature}</li>`).join('')}</ul>
      </div>
      <button class="${plan.featured ? 'primary' : 'outline-orange'} plan-cta" data-route="${plan.route}">${plan.cta}</button>
    </article>`;
}

function plans() {
  const user = currentUser();
  const action = isProvider(user)
    ? '<button class="outline-orange" data-route="equipos">Ir a mis equipos</button>'
    : '<button class="outline-orange" data-route="catalogo">Explorar equipos</button>';

  $('#main').innerHTML = heading(
    'Planes para cada etapa de tu obra',
    'Empieza gratis y cambia de plan cuando tu operación lo necesite. Precios en soles peruanos (S/).',
    action
  ) + `
    <div class="plans-grid">${PLANES.map(planCard).join('')}</div>
    <section class="panel plans-note">
      <div>
        <strong>¿Cómo activo un plan?</strong>
        <p class="muted">Elige el plan que mejor se adapte a tu operación y escríbenos desde Soporte. Coordinamos la activación y los detalles de facturación contigo.</p>
      </div>
      <button class="primary" data-route="soporte">Hablar con el equipo</button>
    </section>`;
}
