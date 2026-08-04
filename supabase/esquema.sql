-- Anima Manager · esquema y permisos
--
-- Se pega entero en el editor SQL de Supabase (Dashboard → SQL Editor → New query).
-- Es idempotente: se puede volver a ejecutar sin romper nada.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Dos decisiones que conviene entender antes de tocar nada:
--
-- 1. Cada registro se guarda como **un jsonb entero**, no como columnas. El modelo de
--    ficha crece cada vez que llega un manual nuevo; con columnas, cada suplemento sería
--    una migración. Sólo se sacan a columna los campos por los que se consulta o se filtra:
--    quién es el dueño, de qué campaña es y cuándo se tocó por última vez.
--
-- 2. Borrar es marcar `borrado = true`, no `DELETE`. Sin esa lápida, una ficha borrada en
--    el móvil reaparecería en la siguiente sincronización desde el portátil, que todavía
--    la tiene. Es el fallo clásico de cualquier sincronización, y se evita así.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Campañas ────────────────────────────────────────────────────────────────

create table if not exists public.campanas (
  id            text primary key,
  propietario   uuid not null references auth.users (id) on delete cascade,
  datos         jsonb not null,
  actualizado_en timestamptz not null default now(),
  borrado       boolean not null default false
);

create index if not exists campanas_propietario_idx on public.campanas (propietario);
create index if not exists campanas_actualizado_idx on public.campanas (actualizado_en);

-- ── Quién juega en cada campaña ─────────────────────────────────────────────
--
-- El máster es el propietario de la campaña. Los jugadores se apuntan aquí, y eso es lo
-- que le permite al máster ver sus fichas —y sólo las de su campaña.

create table if not exists public.miembros_campana (
  campana_id  text not null references public.campanas (id) on delete cascade,
  usuario     uuid not null references auth.users (id) on delete cascade,
  papel       text not null default 'jugador' check (papel in ('master', 'jugador')),
  unido_en    timestamptz not null default now(),
  primary key (campana_id, usuario)
);

create index if not exists miembros_usuario_idx on public.miembros_campana (usuario);

-- ── Personajes ──────────────────────────────────────────────────────────────

create table if not exists public.personajes (
  id            text primary key,
  propietario   uuid not null references auth.users (id) on delete cascade,
  campana_id    text references public.campanas (id) on delete set null,
  datos         jsonb not null,
  actualizado_en timestamptz not null default now(),
  borrado       boolean not null default false
);

create index if not exists personajes_propietario_idx on public.personajes (propietario);
create index if not exists personajes_campana_idx on public.personajes (campana_id);
create index if not exists personajes_actualizado_idx on public.personajes (actualizado_en);

-- ── Enemigos ────────────────────────────────────────────────────────────────
--
-- El bestiario es del máster: los jugadores no tienen por qué ver las fichas de lo que
-- les va a atacar. Por eso no hay política que se los enseñe.

create table if not exists public.enemigos (
  id            text primary key,
  propietario   uuid not null references auth.users (id) on delete cascade,
  campana_id    text references public.campanas (id) on delete set null,
  datos         jsonb not null,
  actualizado_en timestamptz not null default now(),
  borrado       boolean not null default false
);

create index if not exists enemigos_propietario_idx on public.enemigos (propietario);
create index if not exists enemigos_actualizado_idx on public.enemigos (actualizado_en);

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISOS
--
-- Esto es lo importante. La clave `anon` que usa el navegador es **pública por diseño**:
-- va dentro del JavaScript que se descarga cualquiera. Lo único que impide que un usuario
-- lea las fichas de otro son estas políticas. Si Row Level Security no está activo, la
-- base de datos está abierta de par en par.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.campanas         enable row level security;
alter table public.miembros_campana enable row level security;
alter table public.personajes       enable row level security;
alter table public.enemigos         enable row level security;

-- Saber si soy el máster de una campaña, sin repetir la subconsulta en cada política.
-- `security definer` es lo que evita la recursión infinita entre políticas de tablas que
-- se consultan entre sí.
create or replace function public.soy_master_de(id_campana text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campanas c
    where c.id = id_campana and c.propietario = auth.uid()
  );
$$;

create or replace function public.soy_miembro_de(id_campana text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.miembros_campana m
    where m.campana_id = id_campana and m.usuario = auth.uid()
  );
$$;

-- ── Campañas: el máster manda; los jugadores sólo la leen ───────────────────

drop policy if exists "campanas_leer" on public.campanas;
create policy "campanas_leer" on public.campanas for select
  using (propietario = auth.uid() or public.soy_miembro_de(id));

drop policy if exists "campanas_crear" on public.campanas;
create policy "campanas_crear" on public.campanas for insert
  with check (propietario = auth.uid());

drop policy if exists "campanas_editar" on public.campanas;
create policy "campanas_editar" on public.campanas for update
  using (propietario = auth.uid())
  with check (propietario = auth.uid());

drop policy if exists "campanas_borrar" on public.campanas;
create policy "campanas_borrar" on public.campanas for delete
  using (propietario = auth.uid());

-- ── Miembros: cada uno ve dónde juega; el máster gestiona su mesa ───────────

drop policy if exists "miembros_leer" on public.miembros_campana;
create policy "miembros_leer" on public.miembros_campana for select
  using (usuario = auth.uid() or public.soy_master_de(campana_id));

drop policy if exists "miembros_apuntarse" on public.miembros_campana;
create policy "miembros_apuntarse" on public.miembros_campana for insert
  with check (usuario = auth.uid() or public.soy_master_de(campana_id));

drop policy if exists "miembros_salir" on public.miembros_campana;
create policy "miembros_salir" on public.miembros_campana for delete
  using (usuario = auth.uid() or public.soy_master_de(campana_id));

-- ── Personajes ──────────────────────────────────────────────────────────────
--
-- Esta es la política que da sentido a registrarse: un jugador ve **sus** fichas, y el
-- máster ve además las de quienes juegan en su campaña. Nadie más.
--
-- Nótese que el máster puede LEER pero no ESCRIBIR las fichas de sus jugadores: la ficha
-- de un jugador es suya. Si tu mesa prefiere que el máster pueda corregirlas, añade
-- `or public.soy_master_de(campana_id)` a la política de edición.

drop policy if exists "personajes_leer" on public.personajes;
create policy "personajes_leer" on public.personajes for select
  using (propietario = auth.uid() or public.soy_master_de(campana_id));

drop policy if exists "personajes_crear" on public.personajes;
create policy "personajes_crear" on public.personajes for insert
  with check (propietario = auth.uid());

drop policy if exists "personajes_editar" on public.personajes;
create policy "personajes_editar" on public.personajes for update
  using (propietario = auth.uid())
  with check (propietario = auth.uid());

drop policy if exists "personajes_borrar" on public.personajes;
create policy "personajes_borrar" on public.personajes for delete
  using (propietario = auth.uid());

-- ── Enemigos: sólo su dueño ─────────────────────────────────────────────────

drop policy if exists "enemigos_leer" on public.enemigos;
create policy "enemigos_leer" on public.enemigos for select
  using (propietario = auth.uid());

drop policy if exists "enemigos_crear" on public.enemigos;
create policy "enemigos_crear" on public.enemigos for insert
  with check (propietario = auth.uid());

drop policy if exists "enemigos_editar" on public.enemigos;
create policy "enemigos_editar" on public.enemigos for update
  using (propietario = auth.uid())
  with check (propietario = auth.uid());

drop policy if exists "enemigos_borrar" on public.enemigos;
create policy "enemigos_borrar" on public.enemigos for delete
  using (propietario = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Comprobación: esto debe devolver `true` en las cuatro tablas. Si alguna sale `false`,
-- esa tabla está abierta a cualquiera que tenga la URL del proyecto.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- select relname, relrowsecurity from pg_class
-- where relname in ('campanas', 'miembros_campana', 'personajes', 'enemigos');
