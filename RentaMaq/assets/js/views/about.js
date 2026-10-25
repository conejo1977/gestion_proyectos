/* ============================================================================
   RentaMaq · Acerca de RentaMaq
   ----------------------------------------------------------------------------
   Propuesta de valor, funcionamiento, confianza, Cuentas Demo y créditos
   de las fotografías referenciales del catálogo.
   ========================================================================== */

'use strict';

function about() {
  $('#main').innerHTML = heading(
    'RentaMaq: el equipo correcto, cuando la obra lo necesita',
    'Una plataforma para conectar maquinaria disponible con proyectos que necesitan avanzar.'
  ) + `
    <section class="panel">
      <div class="eyebrow">PROPUESTA DE VALOR</div>
      <h2>Conectar equipos disponibles con obras que necesitan avanzar.</h2>
      <p class="muted">RentaMaq reúne a propietarios de maquinaria y equipos con contratistas y constructoras. Centraliza la búsqueda, transparenta las condiciones y facilita la coordinación entre ambas partes.</p>
      <div class="steps">
        <div class="step"><b>01</b><strong>Busca</strong><p>Ubicación, categoría, disponibilidad y presupuesto.</p></div>
        <div class="step"><b>02</b><strong>Compara</strong><p>Capacidad, horas de uso, condiciones y costos.</p></div>
        <div class="step"><b>03</b><strong>Solicita</strong><p>Cotización desglosada y confirmación del proveedor.</p></div>
        <div class="step"><b>04</b><strong>Coordina</strong><p>Entrega, devolución, valoraciones e incidencias.</p></div>
      </div>
    </section>
    <div class="two-col">
      <section class="panel">
        <h3>Para contratistas</h3>
        <ul class="about-list">
          <li>Catálogo con búsqueda, filtros y ordenamiento por ciudad y tarifa.</li>
          <li>Favoritos y comparación de hasta tres equipos.</li>
          <li>Cálculo de jornadas, operador, traslado y garantía antes de solicitar.</li>
          <li>Seguimiento del alquiler: solicitud, confirmación, entrega y devolución.</li>
          <li>Mensajería con el proveedor, incidencias y valoraciones.</li>
          <li>Exportación del historial de alquileres para tu contabilidad.</li>
        </ul>
      </section>
      <section class="panel">
        <h3>Para proveedores</h3>
        <ul class="about-list">
          <li>Publicación de equipos con fotografía, tarifa y condiciones.</li>
          <li>Panel con solicitudes, alquileres activos e importes estimados.</li>
          <li>Confirmación de fechas, registro de entrega y devolución.</li>
          <li>Pausa y edición de anuncios cuando el equipo no esté disponible.</li>
          <li>Sello de datos comerciales confirmados para cuentas revisadas.</li>
          <li>Atención de incidencias vinculadas a cada alquiler.</li>
        </ul>
      </section>
    </div>
    <section class="panel">
      <h3>Confianza, pagos y datos</h3>
      <div class="two-col" style="margin-top:8px">
        <div>
          <p class="muted"><strong>Cuentas protegidas.</strong> RentaMaq usa autenticación de Supabase y reglas de acceso por fila. Cada cuenta solo puede ver sus operaciones, sus conversaciones y sus datos privados.</p>
          <p class="muted"><strong>Perfil público mínimo.</strong> El catálogo muestra el nombre comercial o personal, la ciudad y el sello comercial. El correo y el teléfono no se publican.</p>
        </div>
        <div>
          <p class="muted"><strong>Pagos coordinados entre las partes.</strong> RentaMaq no procesa cobros ni solicita datos de tarjetas. El contratista registra el medio acordado y ambos ven la constancia en el resumen del alquiler.</p>
          <p class="muted"><strong>Garantía reembolsable.</strong> Se muestra aparte del servicio. Su devolución se coordina después de revisar el estado del equipo al finalizar el alquiler.</p>
        </div>
      </div>
      <div class="notice">El sello “Datos comerciales confirmados” acredita que la cuenta completó la revisión básica de nombre comercial, RUC y teléfono. No equivale a una inspección técnica del equipo ni a una revisión documental completa.</div>
    </section>
    <section class="panel">
      <h3>Cuentas Demo</h3>
      <p class="muted">Puedes probar la plataforma con estas cuentas. La contraseña de todas es <strong>Demo1234</strong>.</p>
      <div class="kv-list">
        <div><small>Contratista</small><b>contratista@rentamaq.pe · Constructora Horizonte</b></div>
        <div><small>Proveedor</small><b>proveedor@rentamaq.pe · Miguel Sánchez</b></div>
        <div><small>Proveedor</small><b>norte@rentamaq.pe · Maquinarias del Norte</b></div>
        <div><small>Proveedor</small><b>geo@rentamaq.pe · GeoEquipos Trujillo</b></div>
        <div><small>Proveedor</small><b>rental@rentamaq.pe · Norte Rental</b></div>
        <div><small>Proveedor</small><b>huanchaco@rentamaq.pe · Equipos Huanchaco</b></div>
        <div><small>Proveedor</small><b>energia@rentamaq.pe · Energía para Obras</b></div>
      </div>
      <p class="muted" style="font-size:12.5px;margin-top:11px">También puedes crear cuentas nuevas. Las Cuentas Demo comparten catálogo, solicitudes y mensajes para que puedas seguir el flujo completo entre contratista y proveedor.</p>
    </section>
    <section class="panel">
      <h3>Fotografías referenciales</h3>
      <p class="about-list">Las imágenes del catálogo inicial son referenciales y no acreditan el estado de un equipo publicado por un proveedor.</p>
      <p class="about-list">
        <a class="muted-link" target="_blank" rel="noopener" href="https://operatorpro.co.uk/">Excavadora: OperatorPro</a> ·
        <a class="muted-link" target="_blank" rel="noopener" href="https://www.mr-bricolage.be/betonniere/85389-betonniere-140-l-5411074216160.html">Mezcladora: Mr. Bricolage</a> ·
        <a class="muted-link" target="_blank" rel="noopener" href="https://zenithequipments.com/product/leica-flexline-ts06plus-total-station/">Estación total: Zenith Equipments</a>
      </p>
    </section>`;
}
