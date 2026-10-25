/* ============================================================================
   RentaMaq · Configuración de la plataforma
   ----------------------------------------------------------------------------
   Proyecto de Supabase y credenciales públicas del cliente. La clave anónima
   está diseñada para vivir en el frontend: todas las operaciones están
   protegidas por las políticas RLS de supabase/schema.sql.
   ========================================================================== */

'use strict';

const RM_SUPABASE_URL = 'https://laprapprjecryopmhzfr.supabase.co';
const RM_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhcHJhcHByamVjcnlvcG1oemZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NDE0OTAsImV4cCI6MjEwODUxNzQ5MH0.FfxE5bu-dP0f_jfEN50VSUz0DB6rzZ8r3ebLnkeFE_Y';

const RM_IMAGE_BUCKET = 'equipment-images';
const RM_APP_URL = `${location.origin}${location.pathname}`;
const RM_DEMO_PASSWORD = 'Demo1234';

const RM_DEMO_ACCOUNTS = [
  {
    email: 'contratista@rentamaq.pe',
    label: 'Contratista',
    name: 'Anderson Castro',
    detail: 'Constructora Horizonte',
    role: 'cliente'
  },
  {
    email: 'proveedor@rentamaq.pe',
    label: 'Proveedor',
    name: 'Miguel Sánchez',
    detail: 'Catálogo y solicitudes',
    role: 'proveedor'
  }
];

const RM_OTHER_DEMO_ACCOUNTS = [
  ['norte@rentamaq.pe', 'Maquinarias del Norte'],
  ['geo@rentamaq.pe', 'GeoEquipos Trujillo'],
  ['rental@rentamaq.pe', 'Norte Rental'],
  ['huanchaco@rentamaq.pe', 'Equipos Huanchaco'],
  ['energia@rentamaq.pe', 'Energía para Obras']
];

/* Se captura antes de crear el cliente porque Supabase limpia el enlace de
   recuperación de la barra de direcciones al inicializar la sesión. */
const RM_AUTH_LINK_TYPE = (() => {
  const hash = String(location.hash || '').replace(/^#/, '');
  if (!hash.includes('access_token')) return '';
  const params = new URLSearchParams(hash);
  return params.get('type') || '';
})();

const sb = window.supabase
  ? window.supabase.createClient(RM_SUPABASE_URL, RM_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit'
    }
  })
  : null;
