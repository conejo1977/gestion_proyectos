/* ============================================================================
   RentaMaq · Esquema de base de datos para Supabase
   ----------------------------------------------------------------------------
   Ejecuta este archivo completo en el SQL Editor del proyecto. Después ejecuta
   supabase/seed.sql para cargar las cuentas y el catálogo inicial.

   Incluye:
   - Tablas: profiles, equipment, bookings, threads, messages, tickets,
     reviews y favorites.
   - Reglas de seguridad RLS por cuenta y por operación.
   - Disparadores que calculan importes, validan transiciones de estado,
     protegen los campos comerciales y actualizan valoraciones.
   - Bucket público de fotografías y sus políticas.
   - Publicación Realtime para sincronizar cambios entre dispositivos.
   - Funciones para convertir la cuenta en proveedor, confirmar datos
     comerciales y eliminar la propia cuenta.
   ========================================================================== */

create extension if not exists pgcrypto with schema extensions;

/* ============================================================================
   1. PERFILES
   ========================================================================== */

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Usuario',
  role text not null default 'cliente' check (role in ('cliente', 'proveedor')),
  company text not null default '',
  phone text not null default '',
  city text not null default '',
  ruc text not null default '',
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos de cada cuenta. El correo vive en auth.users y solo lo ve su propietario.';
comment on column public.profiles.verified is 'Confirma que la cuenta completó la revisión básica de datos comerciales de RentaMaq.';

-- Crea el perfil automáticamente cuando Supabase registra una cuenta nueva.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, company, phone, city, ruc)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, 'Usuario'), '@', 1)),
    case when new.raw_user_meta_data ->> 'role' = 'proveedor' then 'proveedor' else 'cliente' end,
    coalesce(new.raw_user_meta_data ->> 'company', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'city', ''),
    coalesce(new.raw_user_meta_data ->> 'ruc', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Actualiza la fecha de modificación de las tablas que lo necesitan.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Vista pública sin correo ni teléfono. Se usa para mostrar nombres de la
-- contraparte en el catálogo, los alquileres y los mensajes.
create or replace view public.profiles_public as
select id, name, role, company, city, verified, created_at
from public.profiles;

alter view public.profiles_public set (security_invoker = off);
revoke all on public.profiles_public from anon, authenticated;
grant select on public.profiles_public to anon, authenticated;

comment on view public.profiles_public is 'Datos públicos mínimos de cada cuenta. No expone correo ni teléfono.';

alter table public.profiles enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid() and role = 'cliente' and verified = false);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- El rol, el RUC y el sello de confianza solo cambian mediante las funciones
-- controladas del final del archivo, nunca con un UPDATE directo del cliente.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
grant update (name, company, phone, city) on public.profiles to authenticated;

/* ============================================================================
   2. CATÁLOGO DE EQUIPOS
   ========================================================================== */

create table if not exists public.equipment (
  id text primary key,
  name text not null,
  category text not null,
  price numeric(12, 2) not null check (price > 0),
  city text not null,
  district text not null default '',
  provider_id uuid not null references public.profiles (id) on delete cascade,
  provider_name text not null default '',
  image text not null default '',
  available boolean not null default true,
  verified boolean not null default false,
  year integer not null default extract(year from now())::integer,
  hours integer not null default 0 check (hours >= 0),
  capacity text not null default '',
  power text not null default '',
  rating numeric(3, 2) not null default 0 check (rating >= 0 and rating <= 5),
  transport numeric(12, 2) not null default 0 check (transport >= 0),
  deposit numeric(12, 2) not null default 0 check (deposit >= 0),
  operator numeric(12, 2) not null default 0 check (operator >= 0),
  description text not null default '',
  custom boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_provider_idx on public.equipment (provider_id);
create index if not exists equipment_category_idx on public.equipment (category);
create index if not exists equipment_city_idx on public.equipment (city);
create index if not exists equipment_available_idx on public.equipment (available);

-- El proveedor no puede falsear el nombre comercial ni el sello de confianza.
create or replace function public.enforce_equipment_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    -- Carga administrativa o script de datos.
    new.updated_at := now();
    return new;
  end if;

  -- Actualizaciones internas de confianza (por ejemplo, el promedio de
  -- valoraciones) no pasan por las restricciones del cliente.
  if coalesce(current_setting('rentamaq.internal', true), '') = 'on' then
    new.updated_at := now();
    return new;
  end if;

  select * into owner_profile from public.profiles where id = auth.uid();
  if owner_profile.id is null or owner_profile.role <> 'proveedor' then
    raise exception 'Solo las cuentas de proveedor pueden publicar equipos.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.provider_id := auth.uid();
    new.provider_name := coalesce(nullif(owner_profile.company, ''), owner_profile.name);
    new.verified := owner_profile.verified;
    new.rating := 0;
    new.custom := true;
    new.created_at := now();
  else
    if old.provider_id <> auth.uid() then
      raise exception 'No puedes modificar un equipo de otra cuenta.' using errcode = '42501';
    end if;
    new.provider_id := old.provider_id;
    new.provider_name := coalesce(nullif(owner_profile.company, ''), owner_profile.name);
    new.verified := owner_profile.verified;
    new.rating := old.rating;
    new.custom := old.custom;
    new.created_at := old.created_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists equipment_enforce_write on public.equipment;
create trigger equipment_enforce_write
  before insert or update on public.equipment
  for each row execute function public.enforce_equipment_write();

alter table public.equipment enable row level security;

drop policy if exists "equipment public read" on public.equipment;
create policy "equipment public read"
  on public.equipment for select
  to anon, authenticated
  using (true);

drop policy if exists "equipment provider insert" on public.equipment;
create policy "equipment provider insert"
  on public.equipment for insert
  to authenticated
  with check (provider_id = auth.uid());

drop policy if exists "equipment provider update" on public.equipment;
create policy "equipment provider update"
  on public.equipment for update
  to authenticated
  using (provider_id = auth.uid())
  with check (provider_id = auth.uid());

drop policy if exists "equipment provider delete" on public.equipment;
create policy "equipment provider delete"
  on public.equipment for delete
  to authenticated
  using (provider_id = auth.uid());

revoke all on public.equipment from anon, authenticated;
grant select on public.equipment to anon, authenticated;
grant insert, update, delete on public.equipment to authenticated;

/* ============================================================================
   3. ALQUILERES
   ========================================================================== */

create table if not exists public.bookings (
  id text primary key default ('RM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  equipment_id text references public.equipment (id) on delete set null,
  equipment_name text not null default '',
  equipment_category text not null default '',
  provider_id uuid references public.profiles (id) on delete set null,
  provider_name text not null default '',
  client_id uuid references public.profiles (id) on delete set null,
  client_name text not null default '',
  client_company text not null default '',
  status text not null default 'Solicitada'
    check (status in ('Cotización', 'Solicitada', 'Confirmada', 'En curso', 'Finalizada', 'Cancelada')),
  start_date date not null,
  end_date date not null,
  days integer not null default 1 check (days > 0),
  base numeric(12, 2) not null default 0,
  operator numeric(12, 2) not null default 0,
  transport numeric(12, 2) not null default 0,
  fee numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  deposit numeric(12, 2) not null default 0,
  project text not null default '',
  address text not null default '',
  paid boolean not null default false,
  payment_method text not null default '',
  paid_at timestamptz,
  reviewed boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_client_idx on public.bookings (client_id);
create index if not exists bookings_provider_idx on public.bookings (provider_id);
create index if not exists bookings_equipment_dates_idx on public.bookings (equipment_id, start_date, end_date);
create index if not exists bookings_status_idx on public.bookings (status);

-- Calcula importes y datos del equipo en el servidor. El cliente no puede
-- alterar tarifas, garantía, comisión ni nombres comerciales.
create or replace function public.prepare_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  machine public.equipment%rowtype;
  client_profile public.profiles%rowtype;
  total_days integer;
begin
  select * into machine from public.equipment where id = new.equipment_id;
  if machine.id is null then
    raise exception 'El equipo ya no está disponible en el catálogo.';
  end if;
  if not machine.available then
    raise exception 'El equipo está pausado y no recibe solicitudes.';
  end if;

  select * into client_profile from public.profiles where id = new.client_id;
  if client_profile.id is null then
    raise exception 'La cuenta del contratista no es válida.';
  end if;
  if machine.provider_id = new.client_id then
    raise exception 'No puedes solicitar tu propio equipo.';
  end if;

  if new.end_date < new.start_date then
    raise exception 'La fecha de devolución debe ser igual o posterior al inicio.';
  end if;

  total_days := (new.end_date - new.start_date) + 1;
  if total_days > 90 then
    raise exception 'El periodo máximo de una solicitud es de 90 días.';
  end if;

  if auth.uid() is null then
    -- Carga administrativa o datos iniciales: se permiten fechas históricas.
    new.created_at := coalesce(new.created_at, now());
  else
    if new.start_date < current_date then
      raise exception 'La fecha de inicio no puede ser anterior a hoy.';
    end if;
    if new.client_id <> auth.uid() then
      raise exception 'La solicitud debe pertenecer a tu cuenta.' using errcode = '42501';
    end if;
    if new.status not in ('Cotización', 'Solicitada') then
      raise exception 'Una solicitud nueva solo puede guardarse como cotización o solicitud.';
    end if;
    new.paid := false;
    new.payment_method := '';
    new.paid_at := null;
    new.reviewed := false;
    new.started_at := null;
    new.finished_at := null;
    new.cancelled_at := null;
    new.cancelled_by := null;
    new.created_at := now();
  end if;

  new.equipment_name := machine.name;
  new.equipment_category := machine.category;
  new.provider_id := machine.provider_id;
  new.provider_name := machine.provider_name;
  new.client_name := client_profile.name;
  new.client_company := client_profile.company;
  new.days := total_days;
  new.base := round(machine.price * total_days, 2);
  new.operator := case when coalesce(new.operator, 0) > 0 then round(machine.operator * total_days, 2) else 0 end;
  new.transport := case when coalesce(new.transport, 0) > 0 then machine.transport else 0 end;
  new.fee := round(new.base * 0.05, 2);
  new.total := round(new.base + new.operator + new.transport + new.fee, 2);
  new.deposit := machine.deposit;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bookings_prepare on public.bookings;
create trigger bookings_prepare
  before insert on public.bookings
  for each row execute function public.prepare_booking();

-- Protege los datos de la operación y controla quién puede mover cada etapa.
create or replace function public.enforce_booking_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  is_client boolean := false;
  is_provider boolean := false;
  overlap integer := 0;
begin
  if actor is null then
    new.updated_at := now();
    return new;
  end if;

  if (new.start_date, new.end_date,
      new.days, new.base, new.operator, new.transport, new.fee, new.total,
      new.deposit, new.project, new.address, new.created_at)
     is distinct from
     (old.start_date, old.end_date,
      old.days, old.base, old.operator, old.transport, old.fee, old.total,
      old.deposit, old.project, old.address, old.created_at) then
    raise exception 'Los datos económicos y las fechas del alquiler no se pueden modificar.';
  end if;

  -- Las referencias pueden quedar en null solo cuando la fila referenciada se
  -- elimina (por ejemplo, al cerrar una cuenta). El cliente no puede cambiarlas.
  if new.equipment_id is distinct from old.equipment_id then
    if not (new.equipment_id is null and old.equipment_id is not null
            and not exists (select 1 from public.equipment where id = old.equipment_id)) then
      raise exception 'El equipo de la operación no se puede modificar.';
    end if;
  end if;

  if new.provider_id is distinct from old.provider_id then
    if not (new.provider_id is null and old.provider_id is not null
            and not exists (select 1 from public.profiles where id = old.provider_id)) then
      raise exception 'El proveedor de la operación no se puede modificar.';
    end if;
  end if;

  if new.client_id is distinct from old.client_id then
    if not (new.client_id is null and old.client_id is not null
            and not exists (select 1 from public.profiles where id = old.client_id)) then
      raise exception 'El contratista de la operación no se puede modificar.';
    end if;
  end if;

  is_client := old.client_id = actor;
  is_provider := old.provider_id = actor;
  if not is_client and not is_provider then
    raise exception 'No tienes acceso a esta operación.' using errcode = '42501';
  end if;

  new.started_at := old.started_at;
  new.finished_at := old.finished_at;
  new.cancelled_at := old.cancelled_at;
  new.cancelled_by := old.cancelled_by;

  if new.status is distinct from old.status then
    if old.status = 'Cotización' and new.status = 'Solicitada' and is_client then
      null;
    elsif old.status = 'Solicitada' and new.status = 'Confirmada' and is_provider then
      select count(*) into overlap
      from public.bookings b
      where b.id <> old.id
        and b.equipment_id = old.equipment_id
        and b.status in ('Confirmada', 'En curso')
        and b.start_date <= old.end_date
        and b.end_date >= old.start_date;
      if overlap > 0 then
        raise exception 'Ya existe otra reserva confirmada en esas fechas.';
      end if;
    elsif old.status = 'Solicitada' and new.status = 'Cancelada' then
      null;
    elsif old.status = 'Confirmada' and new.status = 'En curso' and is_provider then
      new.started_at := now();
    elsif old.status = 'Confirmada' and new.status = 'Cancelada' and is_client then
      null;
    elsif old.status = 'En curso' and new.status = 'Finalizada' and is_provider then
      new.finished_at := now();
    else
      raise exception 'El cambio de estado % a % no está permitido para tu cuenta.', old.status, new.status;
    end if;

    if new.status = 'Cancelada' then
      new.cancelled_at := now();
      new.cancelled_by := actor;
    end if;
  end if;

  if new.paid is distinct from old.paid then
    if not is_client then
      raise exception 'Solo el contratista registra la forma de pago.';
    end if;
    if new.paid then
      if old.status not in ('Confirmada', 'En curso', 'Finalizada') then
        raise exception 'La forma de pago se registra cuando el proveedor confirma la solicitud.';
      end if;
      if coalesce(trim(new.payment_method), '') = '' then
        raise exception 'Indica la forma de pago acordada.';
      end if;
      new.paid_at := now();
    else
      raise exception 'La forma de pago registrada no se puede anular desde la aplicación.';
    end if;
  else
    new.paid_at := old.paid_at;
    new.payment_method := old.payment_method;
  end if;

  if new.reviewed is distinct from old.reviewed then
    if not is_client or old.status <> 'Finalizada' or not new.reviewed then
      raise exception 'La valoración solo la registra el contratista al finalizar el alquiler.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bookings_enforce_update on public.bookings;
create trigger bookings_enforce_update
  before update on public.bookings
  for each row execute function public.enforce_booking_update();

alter table public.bookings enable row level security;

drop policy if exists "bookings participant read" on public.bookings;
create policy "bookings participant read"
  on public.bookings for select
  to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid());

drop policy if exists "bookings client insert" on public.bookings;
create policy "bookings client insert"
  on public.bookings for insert
  to authenticated
  with check (client_id = auth.uid() and status in ('Cotización', 'Solicitada'));

drop policy if exists "bookings participant update" on public.bookings;
create policy "bookings participant update"
  on public.bookings for update
  to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid())
  with check (client_id = auth.uid() or provider_id = auth.uid());

revoke all on public.bookings from anon, authenticated;
grant select, insert, update on public.bookings to authenticated;

/* ============================================================================
   4. MENSAJERÍA
   ========================================================================== */

create table if not exists public.threads (
  id text primary key default ('TH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  participant_ids uuid[] not null check (array_length(participant_ids, 1) = 2),
  equipment_id text not null default '',
  subject text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists threads_unique_pair
  on public.threads (
    least(participant_ids[1], participant_ids[2]),
    greatest(participant_ids[1], participant_ids[2]),
    equipment_id
  );
create index if not exists threads_participants_idx on public.threads using gin (participant_ids);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null references public.threads (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

create or replace function public.bump_thread_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.threads set updated_at = now() where id = new.thread_id;
  return null;
end;
$$;

drop trigger if exists messages_bump_thread on public.messages;
create trigger messages_bump_thread
  after insert on public.messages
  for each row execute function public.bump_thread_activity();

alter table public.threads enable row level security;

drop policy if exists "threads participant read" on public.threads;
create policy "threads participant read"
  on public.threads for select
  to authenticated
  using (auth.uid() = any (participant_ids));

drop policy if exists "threads participant insert" on public.threads;
create policy "threads participant insert"
  on public.threads for insert
  to authenticated
  with check (auth.uid() = any (participant_ids));

alter table public.messages enable row level security;

drop policy if exists "messages participant read" on public.messages;
create policy "messages participant read"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.threads t
      where t.id = messages.thread_id and auth.uid() = any (t.participant_ids)
    )
  );

drop policy if exists "messages participant insert" on public.messages;
create policy "messages participant insert"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.threads t
      where t.id = messages.thread_id and auth.uid() = any (t.participant_ids)
    )
  );

revoke all on public.threads from anon, authenticated;
revoke all on public.messages from anon, authenticated;
grant select, insert on public.threads to authenticated;
grant select, insert on public.messages to authenticated;

/* ============================================================================
   5. SOPORTE
   ========================================================================== */

create table if not exists public.tickets (
  id text primary key default ('TK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  created_by uuid references public.profiles (id) on delete set null,
  booking_id text references public.bookings (id) on delete set null,
  subject text not null default '',
  priority text not null default 'Normal',
  description text not null check (char_length(trim(description)) between 10 and 2000),
  status text not null default 'Registrada' check (status in ('Registrada', 'En revisión', 'Resuelta')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_creator_idx on public.tickets (created_by);
create index if not exists tickets_booking_idx on public.tickets (booking_id);

create or replace function public.enforce_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    new.updated_at := now();
    return new;
  end if;

  if (new.booking_id, new.subject, new.priority, new.description, new.created_at)
     is distinct from
     (old.booking_id, old.subject, old.priority, old.description, old.created_at) then
    if not (
      new.booking_id is null
      and old.booking_id is not null
      and not exists (select 1 from public.bookings where id = old.booking_id)
      and (new.subject, new.priority, new.description, new.created_at)
          is not distinct from
          (old.subject, old.priority, old.description, old.created_at)
    ) then
      raise exception 'El contenido de la incidencia no se puede modificar.';
    end if;
  end if;

  if new.created_by is distinct from old.created_by then
    if not (new.created_by is null and old.created_by is not null
            and not exists (select 1 from public.profiles where id = old.created_by)) then
      raise exception 'El autor de la incidencia no se puede modificar.';
    end if;
  end if;

  if new.status = 'Resuelta' and old.status <> 'Resuelta' then
    new.resolved_at := now();
    new.resolved_by := auth.uid();
  elsif new.status <> 'Resuelta' then
    new.resolved_at := old.resolved_at;
    new.resolved_by := old.resolved_by;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tickets_enforce_update on public.tickets;
create trigger tickets_enforce_update
  before update on public.tickets
  for each row execute function public.enforce_ticket_update();

alter table public.tickets enable row level security;

drop policy if exists "tickets participant read" on public.tickets;
create policy "tickets participant read"
  on public.tickets for select
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.bookings b
      where b.id = tickets.booking_id and b.provider_id = auth.uid()
    )
  );

drop policy if exists "tickets creator insert" on public.tickets;
create policy "tickets creator insert"
  on public.tickets for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "tickets participant update" on public.tickets;
create policy "tickets participant update"
  on public.tickets for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.bookings b
      where b.id = tickets.booking_id and b.provider_id = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.bookings b
      where b.id = tickets.booking_id and b.provider_id = auth.uid()
    )
  );

revoke all on public.tickets from anon, authenticated;
grant select, insert, update on public.tickets to authenticated;

/* ============================================================================
   6. VALORACIONES
   ========================================================================== */

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null unique references public.bookings (id) on delete cascade,
  equipment_id text references public.equipment (id) on delete set null,
  provider_id uuid references public.profiles (id) on delete set null,
  client_id uuid references public.profiles (id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists reviews_equipment_idx on public.reviews (equipment_id);

create or replace function public.prepare_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  operation public.bookings%rowtype;
begin
  select * into operation from public.bookings where id = new.booking_id;
  if operation.id is null then
    raise exception 'El alquiler no existe.';
  end if;
  if operation.status <> 'Finalizada' then
    raise exception 'Solo puedes valorar un alquiler finalizado.';
  end if;
  if auth.uid() is not null and operation.client_id <> auth.uid() then
    raise exception 'Solo el contratista de la operación puede valorar.' using errcode = '42501';
  end if;

  new.client_id := operation.client_id;
  new.provider_id := operation.provider_id;
  new.equipment_id := operation.equipment_id;
  new.created_at := now();

  update public.bookings set reviewed = true where id = operation.id;
  return new;
end;
$$;

drop trigger if exists reviews_prepare on public.reviews;
create trigger reviews_prepare
  before insert on public.reviews
  for each row execute function public.prepare_review();

create or replace function public.refresh_equipment_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id text;
  average_rating numeric;
begin
  if tg_op = 'DELETE' then
    target_id := old.equipment_id;
  else
    target_id := new.equipment_id;
  end if;

  if target_id is not null then
    select round(avg(rating)::numeric, 1) into average_rating
    from public.reviews where equipment_id = target_id;

    perform set_config('rentamaq.internal', 'on', true);
    update public.equipment
    set rating = coalesce(average_rating, 0)
    where id = target_id;
    perform set_config('rentamaq.internal', 'off', true);
  end if;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_equipment_rating();

alter table public.reviews enable row level security;

drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read"
  on public.reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "reviews client insert" on public.reviews;
create policy "reviews client insert"
  on public.reviews for insert
  to authenticated
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = reviews.booking_id
        and b.client_id = auth.uid()
        and b.status = 'Finalizada'
    )
  );

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;

/* ============================================================================
   7. FAVORITOS
   ========================================================================== */

create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  equipment_id text not null references public.equipment (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, equipment_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites own read" on public.favorites;
create policy "favorites own read"
  on public.favorites for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "favorites own insert" on public.favorites;
create policy "favorites own insert"
  on public.favorites for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "favorites own delete" on public.favorites;
create policy "favorites own delete"
  on public.favorites for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

/* ============================================================================
   8. FUNCIONES CONTROLADAS DE CUENTA
   ========================================================================== */

create or replace function public.become_provider(p_company text, p_ruc text, p_phone text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para continuar.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_company, ''))) < 3 then
    raise exception 'Indica el nombre comercial o la razón social.';
  end if;
  if coalesce(p_ruc, '') !~ '^[0-9]{11}$' then
    raise exception 'El RUC debe tener exactamente 11 dígitos.';
  end if;
  if char_length(trim(coalesce(p_phone, ''))) < 6 then
    raise exception 'Indica un teléfono de contacto válido.';
  end if;

  update public.profiles
  set role = 'proveedor',
      company = trim(p_company),
      ruc = trim(p_ruc),
      phone = trim(p_phone),
      verified = false,
      verified_at = null,
      updated_at = now()
  where id = auth.uid()
  returning * into updated;

  if updated.id is null then
    raise exception 'No se encontró el perfil de la cuenta.';
  end if;

  update public.equipment
  set verified = false
  where provider_id = auth.uid();

  return updated;
end;
$$;

create or replace function public.confirm_commercial_data(p_company text, p_ruc text, p_phone text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para continuar.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_company, ''))) < 3 then
    raise exception 'Indica el nombre comercial o la razón social.';
  end if;
  if coalesce(p_ruc, '') !~ '^[0-9]{11}$' then
    raise exception 'El RUC debe tener exactamente 11 dígitos.';
  end if;
  if char_length(trim(coalesce(p_phone, ''))) < 6 then
    raise exception 'Indica un teléfono de contacto válido.';
  end if;

  update public.profiles
  set role = 'proveedor',
      company = trim(p_company),
      ruc = trim(p_ruc),
      phone = trim(p_phone),
      verified = true,
      verified_at = now(),
      updated_at = now()
  where id = auth.uid()
  returning * into updated;

  if updated.id is null then
    raise exception 'No se encontró el perfil de la cuenta.';
  end if;

  update public.equipment
  set verified = true
  where provider_id = auth.uid();

  return updated;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Inicia sesión para eliminar tu cuenta.' using errcode = '42501';
  end if;

  delete from storage.objects
  where bucket_id = 'equipment-images'
    and (storage.foldername(name))[1] = uid::text;

  delete from public.reviews where client_id = uid;
  delete from public.tickets where created_by = uid;
  delete from public.threads where uid = any (participant_ids);
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.become_provider(text, text, text) from public;
revoke all on function public.confirm_commercial_data(text, text, text) from public;
revoke all on function public.delete_own_account() from public;
grant execute on function public.become_provider(text, text, text) to authenticated;
grant execute on function public.confirm_commercial_data(text, text, text) to authenticated;
grant execute on function public.delete_own_account() to authenticated;

/* ============================================================================
   9. FOTOGRAFÍAS DE EQUIPOS
   ========================================================================== */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'equipment-images',
  'equipment-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipment images public read" on storage.objects;
create policy "equipment images public read"
  on storage.objects for select
  using (bucket_id = 'equipment-images');

drop policy if exists "equipment images owner insert" on storage.objects;
create policy "equipment images owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'equipment-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "equipment images owner update" on storage.objects;
create policy "equipment images owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'equipment-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'equipment-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "equipment images owner delete" on storage.objects;
create policy "equipment images owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'equipment-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

/* ============================================================================
   10. SINCRONIZACIÓN EN TIEMPO REAL
   ========================================================================== */

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'equipment', 'bookings', 'threads', 'messages',
    'tickets', 'reviews', 'favorites'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

/* ============================================================================
   Listo. Siguiente paso: ejecutar supabase/seed.sql.
   ========================================================================== */
