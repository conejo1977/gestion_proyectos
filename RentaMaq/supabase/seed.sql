/* ============================================================================
   RentaMaq · Datos iniciales de las Cuentas Demo
   ----------------------------------------------------------------------------
   Ejecuta este archivo DESPUÉS de supabase/schema.sql.

   Crea o actualiza estas cuentas (contraseña: Demo1234):
     contratista@rentamaq.pe  · Anderson Castro · Constructora Horizonte
     proveedor@rentamaq.pe    · Miguel Sánchez
     norte@rentamaq.pe        · Maquinarias del Norte
     geo@rentamaq.pe          · GeoEquipos Trujillo
     rental@rentamaq.pe       · Norte Rental
     huanchaco@rentamaq.pe    · Equipos Huanchaco
     energia@rentamaq.pe      · Energía para Obras

   También carga el catálogo inicial, dos alquileres, una conversación y
   favoritos. Es idempotente: puedes ejecutarlo otra vez sin duplicar datos.
   ========================================================================== */

create or replace function public._seed_demo_user(
  p_email text,
  p_name text,
  p_role text,
  p_company text,
  p_phone text,
  p_city text,
  p_ruc text,
  p_verified boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;

  if v_id is null then
    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      created_at, updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_id,
      'authenticated',
      'authenticated',
      lower(p_email),
      extensions.crypt('Demo1234', extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'name', p_name,
        'role', p_role,
        'company', p_company,
        'phone', p_phone,
        'city', p_city,
        'ruc', p_ruc
      ),
      null, null, null, null,
      now(),
      now()
    );
  else
    update auth.users
    set encrypted_password = extensions.crypt('Demo1234', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmation_token = null,
        recovery_token = null,
        email_change = null,
        email_change_token_new = null,
        raw_user_meta_data = jsonb_build_object(
          'name', p_name,
          'role', p_role,
          'company', p_company,
          'phone', p_phone,
          'city', p_city,
          'ruc', p_ruc
        ),
        updated_at = now()
    where id = v_id;
  end if;

  if not exists (
    select 1 from auth.identities where user_id = v_id and provider = 'email'
  ) then
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    )
    values (
      gen_random_uuid(),
      v_id,
      v_id::text,
      'email',
      jsonb_build_object(
        'sub', v_id::text,
        'email', lower(p_email),
        'email_verified', true,
        'phone_verified', false
      ),
      now(),
      now(),
      now()
    );
  end if;

  insert into public.profiles (
    id, name, role, company, phone, city, ruc, verified, verified_at, created_at, updated_at
  )
  values (
    v_id, p_name, p_role, p_company, p_phone, p_city, p_ruc,
    p_verified, case when p_verified then now() else null end, now(), now()
  )
  on conflict (id) do update
  set name = excluded.name,
      role = excluded.role,
      company = excluded.company,
      phone = excluded.phone,
      city = excluded.city,
      ruc = excluded.ruc,
      verified = excluded.verified,
      verified_at = excluded.verified_at,
      updated_at = now();

  return v_id;
end;
$$;

do $$
declare
  v_client uuid;
  v_miguel uuid;
  v_norte uuid;
  v_geo uuid;
  v_rental uuid;
  v_huanchaco uuid;
  v_energia uuid;
begin
  v_client := public._seed_demo_user(
    'contratista@rentamaq.pe', 'Anderson Castro', 'cliente',
    'Constructora Horizonte', '949 120 330', 'Trujillo', '', false
  );
  v_miguel := public._seed_demo_user(
    'proveedor@rentamaq.pe', 'Miguel Sánchez', 'proveedor',
    'Miguel Sánchez', '944 551 208', 'Trujillo', '20481234567', true
  );
  v_norte := public._seed_demo_user(
    'norte@rentamaq.pe', 'Rosa Medina', 'proveedor',
    'Maquinarias del Norte', '948 332 110', 'Trujillo', '20514477889', true
  );
  v_geo := public._seed_demo_user(
    'geo@rentamaq.pe', 'Luis Paredes', 'proveedor',
    'GeoEquipos Trujillo', '943 887 215', 'Trujillo', '20601122334', true
  );
  v_rental := public._seed_demo_user(
    'rental@rentamaq.pe', 'Carla Rojas', 'proveedor',
    'Norte Rental', '951 204 876', 'Chiclayo', '20487654321', true
  );
  v_huanchaco := public._seed_demo_user(
    'huanchaco@rentamaq.pe', 'Pedro Aguilar', 'proveedor',
    'Equipos Huanchaco', '939 776 441', 'Trujillo', '20713344556', false
  );
  v_energia := public._seed_demo_user(
    'energia@rentamaq.pe', 'Sofía Delgado', 'proveedor',
    'Energía para Obras', '946 330 129', 'Chiclayo', '20658899001', false
  );

  /* ----------------------------- Catálogo -------------------------------- */

  insert into public.equipment (
    id, name, category, price, city, district, provider_id, provider_name,
    image, available, verified, year, hours, capacity, power, rating,
    transport, deposit, operator, description, custom
  )
  values
    (
      'eq1', 'Excavadora hidráulica · 20 t', 'Movimiento de tierras', 1250,
      'Trujillo', 'La Esperanza', v_norte, 'Maquinarias del Norte',
      'assets/img/eq1.jpg', true, true, 2022, 2450, '20 toneladas', '148 HP', 4.9,
      350, 1800, 180,
      'Equipo de orugas para excavación de cimentaciones, zanjas y movimiento de tierras. Cabina cerrada y sistema hidráulico revisado.',
      false
    ),
    (
      'eq2', 'Mezcladora de concreto · 140 L', 'Concreto', 85,
      'Trujillo', 'El Porvenir', v_miguel, 'Miguel Sánchez',
      'assets/img/eq2.jpg', true, true, 2024, 320, '140 litros', '550 W', 4.8,
      35, 180, 0,
      'Mezcladora eléctrica portátil para partidas de albañilería y pequeños vaciados. Incluye cable de alimentación y manual de uso.',
      false
    ),
    (
      'eq3', 'Estación total · precisión 2″', 'Topografía', 180,
      'Trujillo', 'Víctor Larco', v_geo, 'GeoEquipos Trujillo',
      'assets/img/eq3.jpg', true, true, 2023, 580, 'Precisión angular 2″', 'Batería recargable', 4.9,
      25, 750, 150,
      'Instrumento para levantamientos y replanteo. Incluye trípode, prisma, dos baterías, cargador y maletín.',
      false
    ),
    (
      'eq4', 'Excavadora de orugas · 22 t', 'Movimiento de tierras', 1450,
      'Chiclayo', 'José Leonardo Ortiz', v_rental, 'Norte Rental',
      'assets/img/eq4.jpg', true, true, 2023, 1900, '22 toneladas', '160 HP', 4.7,
      400, 2000, 180,
      'Equipo para excavación masiva y carga de material. Transporte mediante cama baja sujeto al acceso de la obra.',
      false
    ),
    (
      'eq5', 'Mezcladora eléctrica · 140 L', 'Concreto', 75,
      'Trujillo', 'Huanchaco', v_huanchaco, 'Equipos Huanchaco',
      'assets/img/eq5.jpg', true, false, 2022, 810, '140 litros', '550 W', 4.5,
      45, 150, 0,
      'Equipo compacto para mezcla de mortero y concreto en pequeñas obras. El cliente debe disponer de alimentación eléctrica.',
      false
    ),
    (
      'eq6', 'Estación total con accesorios', 'Topografía', 160,
      'Trujillo', 'Trujillo Centro', v_miguel, 'Miguel Sánchez',
      'assets/img/eq6.jpg', false, true, 2021, 1320, 'Precisión angular 5″', 'Batería recargable', 4.8,
      20, 600, 140,
      'Estación total para levantamiento y replanteo de proyectos. Temporalmente en calibración.',
      false
    ),
    (
      'eq7', 'Compactadora de plancha · 90 kg', 'Compactación', 95,
      'Trujillo', 'La Esperanza', v_miguel, 'Miguel Sánchez',
      '', true, true, 2023, 470, '90 kg', '5.5 HP', 4.8,
      40, 250, 100,
      'Plancha vibratoria para compactación de material granular, bases y trabajos de confinamiento. Combustible no incluido.',
      false
    ),
    (
      'eq8', 'Andamio tubular · módulo', 'Acceso y herramientas', 18,
      'Trujillo', 'El Porvenir', v_miguel, 'Miguel Sánchez',
      '', true, true, 2024, 0, '1 módulo completo', 'Montaje manual', 4.7,
      30, 100, 0,
      'Módulo de andamio tubular con crucetas y plataforma. La capacidad y configuración final deben verificarse para cada obra.',
      false
    ),
    (
      'eq9', 'Generador portátil · 6 kW', 'Acceso y herramientas', 120,
      'Chiclayo', 'La Victoria', v_energia, 'Energía para Obras',
      '', true, false, 2023, 640, '6 kW', 'Gasolina', 4.6,
      45, 350, 0,
      'Generador de apoyo para herramientas e iluminación temporal. Requiere operación en exteriores ventilados.',
      false
    )
  on conflict (id) do update
  set name = excluded.name,
      category = excluded.category,
      price = excluded.price,
      city = excluded.city,
      district = excluded.district,
      provider_id = excluded.provider_id,
      provider_name = excluded.provider_name,
      image = excluded.image,
      available = excluded.available,
      verified = excluded.verified,
      year = excluded.year,
      hours = excluded.hours,
      capacity = excluded.capacity,
      power = excluded.power,
      rating = excluded.rating,
      transport = excluded.transport,
      deposit = excluded.deposit,
      operator = excluded.operator,
      description = excluded.description,
      custom = excluded.custom,
      updated_at = now();

  /* --------------------------- Alquileres -------------------------------- */

  insert into public.bookings (
    id, equipment_id, provider_id, client_id, status, start_date, end_date,
    operator, transport, project, address, paid, payment_method, paid_at,
    started_at, finished_at, created_at
  )
  values
    (
      'RM-DEMO-1001', 'eq7', v_miguel, v_client, 'Solicitada',
      current_date + 3, current_date + 5, 1, 1,
      'Ampliación de almacén Los Cedros',
      'Av. Sánchez Carrión 1450, La Esperanza',
      false, '', null, null, null, now() - interval '6 hours'
    ),
    (
      'RM-DEMO-1000', 'eq2', v_miguel, v_client, 'Finalizada',
      current_date - 18, current_date - 16, 0, 1,
      'Vivienda unifamiliar El Porvenir',
      'Calle Los Álamos 220, El Porvenir',
      true, 'Transferencia bancaria', now() - interval '15 days',
      now() - interval '18 days', now() - interval '16 days', now() - interval '20 days'
    )
  on conflict (id) do nothing;

  /* --------------------------- Conversación ------------------------------ */

  insert into public.threads (
    id, participant_ids, equipment_id, subject, created_at, updated_at
  )
  values (
    'th_cliente_miguel',
    array[v_client, v_miguel],
    'eq7',
    'Compactadora de plancha · 90 kg',
    now() - interval '3 days',
    now() - interval '3 days'
  )
  on conflict (id) do nothing;

  if not exists (select 1 from public.messages where thread_id = 'th_cliente_miguel') then
    insert into public.messages (thread_id, sender_id, body, created_at)
    values
      (
        'th_cliente_miguel', v_miguel,
        'Hola, soy Miguel. La compactadora está disponible y revisada. Puedo coordinar la entrega en La Esperanza el mismo día del inicio.',
        now() - interval '3 days'
      ),
      (
        'th_cliente_miguel', v_client,
        'Gracias. La obra está en Sánchez Carrión 1450. ¿La entrega incluye el traslado y el operador?',
        now() - interval '3 days' + interval '22 minutes'
      ),
      (
        'th_cliente_miguel', v_miguel,
        'El traslado y el operador se cotizan por separado, tal como aparece en la ficha. Cualquier cambio de fechas lo coordinamos por aquí.',
        now() - interval '3 days' + interval '31 minutes'
      );
  end if;

  /* ----------------------------- Favoritos ------------------------------- */

  insert into public.favorites (user_id, equipment_id)
  values (v_client, 'eq1'), (v_client, 'eq3')
  on conflict do nothing;
end;
$$;

drop function if exists public._seed_demo_user(text, text, text, text, text, text, text, boolean);

/* ============================================================================
   Listo. Ingresa con contratista@rentamaq.pe / Demo1234.
   ========================================================================== */
