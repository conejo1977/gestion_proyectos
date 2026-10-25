/* ============================================================================
   RentaMaq · Acerca del prototipo
   ----------------------------------------------------------------------------
   Propuesta de valor, alcance, funciones disponibles y atribución de las
   fotografías referenciales del catálogo.
   ========================================================================== */

'use strict';

function about() {
  $('#main').innerHTML = heading(
    'RentaMaq: del proyecto a la experiencia',
    'Prototipo académico basado en el informe y las sesiones 03 y 04.'
  ) + `
    <section class="panel">
      <div class="eyebrow">PROPUESTA DE VALOR</div>
      <h2>Conectar equipos disponibles con obras que necesitan avanzar.</h2>
      <p class="muted">RentaMaq conecta propietarios de maquinaria y equipos con contratistas y constructoras. Centraliza la búsqueda, transparenta las condiciones y propone mecanismos de confianza para ambas partes.</p>
      <div class="steps">
        <div class="step"><b>01</b><strong>Busca</strong><p>Ubicación, categoría, disponibilidad y presupuesto.</p></div>
        <div class="step"><b>02</b><strong>Compara</strong><p>Capacidad, horas de uso, mantenimiento y costos.</p></div>
        <div class="step"><b>03</b><strong>Solicita</strong><p>Cotización desglosada y confirmación del proveedor.</p></div>
        <div class="step"><b>04</b><strong>Coordina</strong><p>Entrega, devolución, valoraciones e incidencias.</p></div>
      </div>
    </section>
    <div class="two-col">
      <section class="panel">
        <h3>Lo que puedes probar</h3>
        <ul class="about-list">
          <li>Registro e inicio de sesión de contratistas y proveedores.</li>
          <li>Recuperación de contraseña con pregunta de seguridad.</li>
          <li>Catálogo con búsqueda, filtros y ordenamiento.</li>
          <li>Favoritos y comparación de hasta tres equipos.</li>
          <li>Cálculo de jornadas, operador, traslado y garantía.</li>
          <li>Solicitudes conectadas entre las cuentas del navegador.</li>
          <li>Publicación y edición de equipos con fotografía propia.</li>
          <li>Verificación simulada de proveedores y sello de confianza.</li>
          <li>Mensajes locales, incidencias, reseñas y exportación CSV.</li>
        </ul>
      </section>
      <section class="panel">
        <h3>Alcance de la demostración</h3>
        <p class="about-list">Todos los proveedores, precios, estados de verificación y valoraciones son ejemplos. Las fotografías referenciales no acreditan un anuncio real. La comisión de 5% es un supuesto ilustrativo, no un porcentaje establecido en el informe.</p>
        <p class="about-list">Las cuentas, contraseñas (hasheadas con sal), imágenes y operaciones se guardan únicamente en localStorage. No hay servidor, base de datos compartida, pasarela de pagos ni verificación documental real.</p>
        <p class="about-list">Para operar comercialmente se necesitarían autenticación del lado del servidor, base de datos compartida, verificación documental, mensajería real, pasarela de pagos y revisión de las condiciones contractuales.</p>
      </section>
    </div>
    <section class="panel">
      <h3>Cuentas de demostración</h3>
      <div class="kv-list">
        <div><small>Contratista</small><b>contratista@rentamaq.pe · Demo1234</b></div>
        <div><small>Proveedor</small><b>proveedor@rentamaq.pe · Demo1234</b></div>
      </div>
      <p class="muted" style="font-size:12.5px;margin-top:11px">También puedes crear cuentas nuevas. Las cuentas demo de otros proveedores usan la misma contraseña y sirven para probar la mensajería y las solicitudes.</p>
      <h3 style="margin-top:24px">Documentos de base</h3>
      <ul class="about-list">
        <li>informe.pdf · RentaMaq: plataforma que conecta proveedores de maquinaria y equipos con contratistas y constructoras.</li>
        <li>Sesión 03 · Design Thinking, proto personas y definición de la necesidad.</li>
        <li>Sesión 04 · Modelo de negocio, propuesta de valor y círculo dorado.</li>
      </ul>
      <h3>Imágenes referenciales</h3>
      <p class="about-list">
        <a class="muted-link" target="_blank" rel="noopener" href="https://operatorpro.co.uk/courses/">Excavadora: OperatorPro</a> ·
        <a class="muted-link" target="_blank" rel="noopener" href="https://www.mr-bricolage.be/betonniere/85389-betonniere-140-l-5411074216160.html">Mezcladora: Mr. Bricolage</a> ·
        <a class="muted-link" target="_blank" rel="noopener" href="https://zenithequipments.com/product/leica-flexline-ts06plus-total-station/">Estación total: Zenith Equipments</a>
      </p>
    </section>`;
}
