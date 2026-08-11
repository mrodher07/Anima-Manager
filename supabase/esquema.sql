-- Anima Manager · esquema y permisos
--
-- Se pega entero en el editor SQL de Supabase (Dashboard → SQL Editor → New query).
-- Es idempotente: se puede volver a ejecutar sin romper nada.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- Tres decisiones que conviene entender antes de tocar nada:
--
-- 1. Cada registro se guarda como **un jsonb entero**, no como columnas. El modelo de
--    ficha crece cada vez que llega un manual nuevo; con columnas, cada suplemento sería
--    una migración. Sólo se sacan a columna los campos por los que se consulta o se filtra:
--    quién es el dueño, de qué campaña es y cuándo se tocó por última vez.
--
-- 2. Borrar es marcar `borrado = true`, no `DELETE`. Sin esa lápida, una ficha borrada en
--    el móvil reaparecería en la siguiente sincronización desde el portátil, que todavía
--    la tiene. Es el fallo clásico de cualquier sincronización, y se evita así.
--
-- 3. Las imágenes **no** van en una fila. Un mapa pesa cientos de kilobytes y Postgres no
--    es el sitio: los archivos van a Storage y aquí sólo queda su ficha técnica. La tabla
--    y el archivo se protegen con las mismas reglas, para que no se pueda leer un mapa
--    esquivando la tabla.
--
-- Índice de lo que crea este archivo:
--
--    perfiles              nombre visible de cada usuario
--    campanas              la mesa: reglas caseras, manuales activos, diario
--    miembros_campana      quién juega en cada campaña
--    invitaciones_campana  códigos para unirse a una mesa
--    personajes            las fichas
--    enemigos              el bestiario del máster
--    tiradas               el registro de la partida, visible para toda la mesa
--    imagenes              retratos, mapas y galería (el archivo vive en Storage)
--    preferencias          tema y ajustes de cada usuario
--
--    paquetes              los manuales y los paquetes de contenido de cada mesa
--    catalogo              cada entrada del catálogo: razas, ventajas, conjuros, armas…
--    manuales_campana      qué paquetes tiene activos una campaña
--    ajustes_campana       nivel de inicio, Puntos de Creación y sistema de combate
--    reglas_campana        cada fórmula reescrita o desactivada por la mesa
--    diario_campana        las notas de sesión, una fila por sesión
--
-- 4. **El login no está aquí, y es a propósito.** De las cuentas se encarga Supabase Auth
--    en el esquema `auth`: correos, contraseñas cifradas, tokens y sesiones. Escribir
--    nuestra propia tabla de usuarios con contraseñas sería rehacer peor lo que ya está
--    hecho y auditado, así que lo que hay aquí es lo que **rodea** a la cuenta y sí nos
--    pertenece: el perfil visible, las preferencias y quién juega en qué mesa. Todo
--    cuelga de `auth.users` con `on delete cascade`: al borrar la cuenta desaparece todo.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Perfiles ────────────────────────────────────────────────────────────────
--
-- `auth.users` no se puede leer desde el navegador, y con razón: contiene correos. Pero el
-- máster necesita saber que la ficha de Zhaira es de Miguel y no de
-- `a3f1…-9c02`. Este perfil es lo mínimo para eso, y lo elige cada uno.

create table if not exists public.perfiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  nombre        text not null default '',
  actualizado_en timestamptz not null default now()
);

-- El perfil se crea solo al registrarse. Si se dejara a la aplicación, una cuenta creada
-- desde otro sitio —o un registro interrumpido a medias— se quedaría sin él.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();


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


-- ── Invitaciones ────────────────────────────────────────────────────────────
--
-- Sin esto no había forma honesta de entrar en una mesa. Apuntarse uno mismo sólo con el
-- id de la campaña sería un agujero: los ids viajan dentro de las fichas exportadas, así
-- que cualquiera que hubiera visto una ficha podría meterse en la campaña y leer las del
-- resto. Con invitación, entrar exige un código que sólo reparte el máster.

create table if not exists public.invitaciones_campana (
  codigo       text primary key,
  campana_id   text not null references public.campanas (id) on delete cascade,
  creada_por   uuid not null references auth.users (id) on delete cascade,
  creada_en    timestamptz not null default now(),
  -- Null = no caduca. Se recomienda ponerle fecha: un código que dura para siempre acaba
  -- circulando por un chat de hace dos años.
  caduca_en    timestamptz,
  usos_maximos integer not null default 20 check (usos_maximos > 0),
  usos         integer not null default 0
);

create index if not exists invitaciones_campana_idx on public.invitaciones_campana (campana_id);


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


-- ── Tiradas ─────────────────────────────────────────────────────────────────
--
-- El registro de la partida. Hasta ahora vivía en memoria y se perdía al recargar: media
-- sesión de tiradas desaparecía porque alguien tocó el botón de atrás.
--
-- A diferencia de las fichas, una tirada **la ve toda la mesa**. Es lo suyo: en una partida
-- presencial los dados están encima del tablero y los ve todo el mundo. Escribir sólo puede
-- quien tiró.

create table if not exists public.tiradas (
  id            text primary key,
  propietario   uuid not null references auth.users (id) on delete cascade,
  campana_id    text references public.campanas (id) on delete cascade,
  datos         jsonb not null,
  actualizado_en timestamptz not null default now(),
  borrado       boolean not null default false
);

create index if not exists tiradas_campana_idx on public.tiradas (campana_id, actualizado_en desc);
create index if not exists tiradas_propietario_idx on public.tiradas (propietario);


-- ── Imágenes ────────────────────────────────────────────────────────────────
--
-- Aquí sólo está la ficha técnica. El archivo vive en el bucket `imagenes` de Storage, en
-- `{uid}/{id}.webp`. Esa ruta no es decorativa: las políticas de Storage miran la primera
-- carpeta para saber de quién es el archivo, así que la estructura **es** el permiso.
--
-- La aplicación ya reescala y convierte a WebP antes de subir (1600 px de lado para mapas,
-- 640 para retratos), así que lo que llega aquí son decenas de kilobytes, no megas.

create table if not exists public.imagenes (
  id            text primary key,
  propietario   uuid not null references auth.users (id) on delete cascade,
  campana_id    text references public.campanas (id) on delete set null,
  personaje_id  text,
  tipo          text not null default 'otro'
                check (tipo in ('retrato', 'mapa', 'pnj', 'enemigo', 'objeto', 'otro')),
  nombre        text not null default '',
  descripcion   text,
  anchura       integer not null default 0,
  altura        integer not null default 0,
  bytes         integer not null default 0,
  /** Ruta dentro del bucket. Se guarda para no tener que reconstruirla en cada consulta. */
  ruta          text not null,
  actualizado_en timestamptz not null default now(),
  borrado       boolean not null default false
);

create index if not exists imagenes_propietario_idx on public.imagenes (propietario);
create index if not exists imagenes_campana_idx on public.imagenes (campana_id);


-- ── Preferencias ────────────────────────────────────────────────────────────
--
-- Una fila por usuario, con el tema y lo que vaya haciendo falta. Es un jsonb porque las
-- preferencias son exactamente el tipo de cosa que crece de una en una, y no merece una
-- migración cada vez que se añade una casilla.

create table if not exists public.preferencias (
  id            uuid primary key references auth.users (id) on delete cascade,
  datos         jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- EL CATÁLOGO
--
-- Hasta aquí el catálogo —las 3.400 y pico entradas de los manuales— vivía sólo en los
-- JSON que se sirven con la aplicación, y el contenido propio de cada mesa, dentro del
-- jsonb de su campaña. Estas dos tablas lo ponen todo en la base de datos con la misma
-- forma, de modo que una raza del Core y una raza que se ha inventado tu mesa son la
-- misma clase de fila y se consultan igual.
--
-- **Lo de los manuales no se borra.** Las entradas oficiales se marcan con `oficial` y
-- más abajo **no se les escribe ninguna política de update ni de delete**: con Row Level
-- Security activo, lo que no tiene política está prohibido. Nadie que entre con la clave
-- pública puede tocarlas, ni por error ni queriendo. Una mesa que quiera cambiar una raza
-- del manual no la modifica: crea la suya con el mismo nombre en su propio paquete, que
-- es como ha funcionado siempre el sistema de paquetes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Paquetes de contenido ───────────────────────────────────────────────────
--
-- Un manual es un paquete y el contenido propio de una mesa es otro. La `prioridad`
-- decide quién gana cuando dos paquetes traen una entrada con el mismo nombre: el número
-- más alto manda, y el contenido de la mesa va por encima de todos.

create table if not exists public.paquetes (
  id            text primary key,
  nombre        text not null,
  descripcion   text not null default '',
  -- Las dos o tres letras que la interfaz pone junto a cada entrada: CE, AE, LQC.
  sigla         text not null default '',
  prioridad     integer not null default 0,
  -- true = viene de un manual. Esas filas son de sólo lectura para todo el mundo.
  oficial       boolean not null default false,
  -- Null en los oficiales; en los de mesa, quién los creó.
  propietario   uuid references auth.users (id) on delete cascade,
  -- Un paquete de mesa puede colgar de su campaña, y entonces lo ve toda la mesa.
  campana_id    text references public.campanas (id) on delete cascade,
  actualizado_en timestamptz not null default now(),
  borrado       boolean not null default false,
  -- Un paquete es de un manual o de alguien, nunca las dos cosas ni ninguna.
  constraint paquete_con_dueno check (oficial or propietario is not null)
);

create index if not exists paquetes_propietario_idx on public.paquetes (propietario);
create index if not exists paquetes_campana_idx on public.paquetes (campana_id);
create index if not exists paquetes_oficial_idx on public.paquetes (oficial) where oficial;


-- ── Las entradas del catálogo ───────────────────────────────────────────────
--
-- Una fila por entrada: una raza, una ventaja, un conjuro, una habilidad secundaria de la
-- casa. `coleccion` dice de qué tabla del manual es y `clave` es el nombre que la
-- identifica —lo mismo que usa la aplicación para decidir que una entrada sustituye a
-- otra. El contenido va en `datos` por lo mismo que las fichas: cada colección tiene sus
-- campos y llegan más con cada suplemento.

create table if not exists public.catalogo (
  paquete_id    text not null references public.paquetes (id) on delete cascade,
  -- 'razas', 'ventajas', 'conjuros', 'secundarias'… el nombre que usa la aplicación.
  coleccion     text not null,
  clave         text not null,
  datos         jsonb not null,
  actualizado_en timestamptz not null default now(),
  borrado       boolean not null default false,
  primary key (paquete_id, coleccion, clave)
);

create index if not exists catalogo_coleccion_idx on public.catalogo (coleccion);
create index if not exists catalogo_paquete_idx on public.catalogo (paquete_id, coleccion);
create index if not exists catalogo_actualizado_idx on public.catalogo (actualizado_en);


-- ─────────────────────────────────────────────────────────────────────────────
-- LO QUE ESTABA DENTRO DEL JSONB DE LA CAMPAÑA
--
-- La campaña sigue guardándose entera en `campanas.datos`, que es lo que sincroniza la
-- aplicación hoy. Estas tablas sacan a filas las cuatro partes que tienen vida propia
-- —los manuales activos, las cifras de creación, las reglas caseras y el diario— porque
-- son justo las que interesa consultar por separado: saber qué mesas han tocado una
-- fórmula, o listar las sesiones sin traerse la campaña completa.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Manuales activos de cada campaña ────────────────────────────────────────

create table if not exists public.manuales_campana (
  campana_id  text not null references public.campanas (id) on delete cascade,
  paquete_id  text not null references public.paquetes (id) on delete cascade,
  activo      boolean not null default true,
  primary key (campana_id, paquete_id)
);


-- ── Cifras de partida y sistema de combate ──────────────────────────────────
--
-- Los valores por defecto son los del manual básico: nivel 1, 3 Puntos de Creación y
-- tope de 3 por desventajas. No son decorativos: llegan a la ficha.

create table if not exists public.ajustes_campana (
  campana_id            text primary key references public.campanas (id) on delete cascade,
  nivel_inicial         integer not null default 1 check (nivel_inicial >= 0),
  puntos_creacion       integer not null default 3 check (puntos_creacion >= 0),
  maximo_por_desventajas integer not null default 3 check (maximo_por_desventajas >= 0),
  -- El dramático sólo estira la duración del asalto; no cambia ninguna otra regla.
  sistema_combate       text not null default 'normal'
                        check (sistema_combate in ('normal', 'dramatico')),
  actualizado_en        timestamptz not null default now()
);


-- ── Reglas caseras ──────────────────────────────────────────────────────────
--
-- Una fila por regla que la mesa haya tocado. `formula` null y `activa` false es una
-- regla desactivada; `formula` con texto es una fórmula reescrita. No estar en esta tabla
-- significa «como en el manual», que es lo que le pasa a la inmensa mayoría.
--
-- Ojo con lo que se guarda aquí: esa fórmula la escribe un jugador y **se evalúa en el
-- navegador del máster**. Por eso la aplicación no usa `eval` sino un evaluador acotado
-- que sólo entiende números y las cuatro operaciones. Guardar texto en esta columna es
-- seguro; ejecutarlo de cualquier otra forma no lo sería.

create table if not exists public.reglas_campana (
  campana_id     text not null references public.campanas (id) on delete cascade,
  clave          text not null,
  formula        text,
  activa         boolean not null default true,
  actualizado_en timestamptz not null default now(),
  primary key (campana_id, clave)
);


-- ── Diario de la campaña ────────────────────────────────────────────────────

create table if not exists public.diario_campana (
  id             text primary key,
  campana_id     text not null references public.campanas (id) on delete cascade,
  fecha          date not null default current_date,
  titulo         text not null default '',
  texto          text not null default '',
  escrita_por    uuid references auth.users (id) on delete set null,
  actualizado_en timestamptz not null default now(),
  borrado        boolean not null default false
);

create index if not exists diario_campana_idx on public.diario_campana (campana_id, fecha desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- EVOLUCIÓN DEL ESQUEMA
--
-- Este archivo se vuelve a ejecutar entero cada vez que cambia, así que tiene que poder
-- aplicarse sobre una base de datos que ya existe. Y ahí hay una trampa: `create table
-- if not exists` **no añade columnas nuevas** a una tabla que ya está creada. Se ejecuta
-- sin error y sin hacer nada, que es la peor combinación posible.
--
-- Por eso toda columna que se añada después de la primera versión se repite aquí con
-- `add column if not exists`. La definición de arriba es la de referencia —lo que verías
-- si crearas la base desde cero— y esto es lo que la aplica a las que ya existían.
--
-- Al añadir una columna nueva: se pone en su `create table` de arriba **y** una línea
-- aquí. Las dos cosas, siempre.
-- ─────────────────────────────────────────────────────────────────────────────

-- (De momento no hay ninguna: todas las tablas se crearon con sus columnas actuales.
-- Cuando haga falta, el patrón es este:)
--
--   alter table public.perfiles add column if not exists avatar_url text;

-- Un aviso si alguien añade una columna arriba y se olvida de repetirla aquí. No puede
-- comprobarlo todo, pero sí las tablas que más se tocan.
do $$
declare
  falta text;
begin
  select string_agg(esperada, ', ') into falta
  from (
    values
      ('perfiles', 'nombre'),
      ('paquetes', 'oficial'),
      ('catalogo', 'datos'),
      ('ajustes_campana', 'sistema_combate'),
      ('reglas_campana', 'formula'),
      ('diario_campana', 'texto')
  ) as v(tabla, columna),
  lateral (select v.tabla || '.' || v.columna as esperada) e
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = v.tabla and c.column_name = v.columna
  );

  if falta is not null then
    raise exception 'Faltan columnas en la base de datos: %. Añádelas en la sección EVOLUCIÓN DEL ESQUEMA.', falta;
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISOS
--
-- Esto es lo importante. La clave `anon` que usa el navegador es **pública por diseño**:
-- va dentro del JavaScript que se descarga cualquiera. Lo único que impide que un usuario
-- lea las fichas de otro son estas políticas. Si Row Level Security no está activo, la
-- base de datos está abierta de par en par.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.perfiles             enable row level security;
alter table public.campanas             enable row level security;
alter table public.miembros_campana     enable row level security;
alter table public.invitaciones_campana enable row level security;
alter table public.personajes           enable row level security;
alter table public.enemigos             enable row level security;
alter table public.tiradas              enable row level security;
alter table public.imagenes             enable row level security;
alter table public.preferencias         enable row level security;
alter table public.paquetes             enable row level security;
alter table public.catalogo             enable row level security;
alter table public.manuales_campana     enable row level security;
alter table public.ajustes_campana      enable row level security;
alter table public.reglas_campana       enable row level security;
alter table public.diario_campana       enable row level security;

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

-- ── Perfiles: los ve la gente con la que juegas ─────────────────────────────
--
-- No es un directorio público: sólo se ve el nombre de quien comparte mesa contigo. El
-- correo no está aquí, así que nadie puede sacar una lista de correos registrados.

create or replace function public.comparto_mesa_con(otro uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    -- Es jugador de una campaña mía.
    select 1 from public.miembros_campana m
    join public.campanas c on c.id = m.campana_id
    where m.usuario = otro and c.propietario = auth.uid()
  ) or exists (
    -- Es el máster de una campaña en la que juego.
    select 1 from public.campanas c
    join public.miembros_campana m on m.campana_id = c.id
    where c.propietario = otro and m.usuario = auth.uid()
  ) or exists (
    -- Jugamos los dos en la misma campaña.
    select 1 from public.miembros_campana mio
    join public.miembros_campana suyo on suyo.campana_id = mio.campana_id
    where mio.usuario = auth.uid() and suyo.usuario = otro
  );
$$;

drop policy if exists "perfiles_leer" on public.perfiles;
create policy "perfiles_leer" on public.perfiles for select
  using (id = auth.uid() or public.comparto_mesa_con(id));

drop policy if exists "perfiles_editar" on public.perfiles;
create policy "perfiles_editar" on public.perfiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- El trigger crea el perfil, pero se deja también el insert por si hiciera falta
-- recrearlo: sólo el propio.
drop policy if exists "perfiles_crear" on public.perfiles;
create policy "perfiles_crear" on public.perfiles for insert
  with check (id = auth.uid());

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
--
-- Ojo con el insert: **un jugador no puede apuntarse solo**. Antes la política dejaba
-- insertar cualquier fila con `usuario = auth.uid()`, y eso significaba que quien
-- conociera el id de una campaña —que viaja dentro de cada ficha exportada— podía meterse
-- en ella y leer las fichas del resto. Ahora sólo el máster inserta a mano; los jugadores
-- entran por `unirse_a_campana`, que exige código.

drop policy if exists "miembros_leer" on public.miembros_campana;
create policy "miembros_leer" on public.miembros_campana for select
  using (usuario = auth.uid() or public.soy_master_de(campana_id));

drop policy if exists "miembros_apuntarse" on public.miembros_campana;
drop policy if exists "miembros_anadir" on public.miembros_campana;
create policy "miembros_anadir" on public.miembros_campana for insert
  with check (public.soy_master_de(campana_id));

-- Salir de una mesa siempre se puede; el máster también puede echar a alguien.
drop policy if exists "miembros_salir" on public.miembros_campana;
create policy "miembros_salir" on public.miembros_campana for delete
  using (usuario = auth.uid() or public.soy_master_de(campana_id));

-- ── Invitaciones: las gestiona el máster ────────────────────────────────────
--
-- No hay política de lectura para quien recibe el código, y es a propósito: si se pudieran
-- leer, se podrían listar todos los códigos válidos del sistema. Canjearlo se hace por
-- `unirse_a_campana`, que comprueba el código por dentro sin enseñar la tabla.

drop policy if exists "invitaciones_leer" on public.invitaciones_campana;
create policy "invitaciones_leer" on public.invitaciones_campana for select
  using (public.soy_master_de(campana_id));

drop policy if exists "invitaciones_crear" on public.invitaciones_campana;
create policy "invitaciones_crear" on public.invitaciones_campana for insert
  with check (public.soy_master_de(campana_id) and creada_por = auth.uid());

drop policy if exists "invitaciones_borrar" on public.invitaciones_campana;
create policy "invitaciones_borrar" on public.invitaciones_campana for delete
  using (public.soy_master_de(campana_id));

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

-- ── Tiradas: las ve la mesa entera, las escribe quien tiró ──────────────────

drop policy if exists "tiradas_leer" on public.tiradas;
create policy "tiradas_leer" on public.tiradas for select
  using (
    propietario = auth.uid()
    or (campana_id is not null
        and (public.soy_master_de(campana_id) or public.soy_miembro_de(campana_id)))
  );

drop policy if exists "tiradas_crear" on public.tiradas;
create policy "tiradas_crear" on public.tiradas for insert
  with check (propietario = auth.uid());

-- Una tirada no se edita: lo único que se hace con ella es marcarla borrada al vaciar el
-- registro, y eso pasa por aquí.
drop policy if exists "tiradas_editar" on public.tiradas;
create policy "tiradas_editar" on public.tiradas for update
  using (propietario = auth.uid())
  with check (propietario = auth.uid());

drop policy if exists "tiradas_borrar" on public.tiradas;
create policy "tiradas_borrar" on public.tiradas for delete
  using (propietario = auth.uid());

-- ── Imágenes ────────────────────────────────────────────────────────────────
--
-- Un mapa se enseña en la mesa: si la imagen es de una campaña, la ve quien juegue en
-- ella. Las que no tienen campaña son privadas de su dueño.

drop policy if exists "imagenes_leer" on public.imagenes;
create policy "imagenes_leer" on public.imagenes for select
  using (
    propietario = auth.uid()
    or (campana_id is not null and (public.soy_master_de(campana_id) or public.soy_miembro_de(campana_id)))
  );

drop policy if exists "imagenes_crear" on public.imagenes;
create policy "imagenes_crear" on public.imagenes for insert
  with check (propietario = auth.uid());

drop policy if exists "imagenes_editar" on public.imagenes;
create policy "imagenes_editar" on public.imagenes for update
  using (propietario = auth.uid())
  with check (propietario = auth.uid());

drop policy if exists "imagenes_borrar" on public.imagenes;
create policy "imagenes_borrar" on public.imagenes for delete
  using (propietario = auth.uid());

-- ── Preferencias: de cada uno y de nadie más ────────────────────────────────

drop policy if exists "preferencias_leer" on public.preferencias;
create policy "preferencias_leer" on public.preferencias for select
  using (id = auth.uid());

drop policy if exists "preferencias_crear" on public.preferencias;
create policy "preferencias_crear" on public.preferencias for insert
  with check (id = auth.uid());

drop policy if exists "preferencias_editar" on public.preferencias;
create policy "preferencias_editar" on public.preferencias for update
  using (id = auth.uid())
  with check (id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- UNIRSE A UNA CAMPAÑA
--
-- Canjear un código no se puede expresar con una política: hay que mirar una tabla que el
-- jugador no puede leer, comprobar caducidad y usos, y escribir en dos sitios. Por eso es
-- una función `security definer`, que es la forma correcta de decir «esta operación
-- concreta puede saltarse las políticas, y sólo hace esto».
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.unirse_a_campana(codigo_invitacion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitaciones_campana;
  camp public.campanas;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Hay que entrar en la cuenta primero.');
  end if;

  select * into inv from public.invitaciones_campana
  where codigo = upper(trim(codigo_invitacion));

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ese código no existe.');
  end if;
  if inv.caduca_en is not null and inv.caduca_en < now() then
    return jsonb_build_object('ok', false, 'error', 'Ese código ha caducado. Pídele otro al máster.');
  end if;
  if inv.usos >= inv.usos_maximos then
    return jsonb_build_object('ok', false, 'error', 'Ese código ya se ha usado demasiadas veces.');
  end if;

  select * into camp from public.campanas where id = inv.campana_id and not borrado;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'La campaña ya no existe.');
  end if;
  if camp.propietario = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Esa campaña ya es tuya: eres el máster.');
  end if;

  -- Volver a canjear el mismo código no gasta un uso ni duplica la fila.
  if exists (
    select 1 from public.miembros_campana
    where campana_id = inv.campana_id and usuario = auth.uid()
  ) then
    return jsonb_build_object('ok', true, 'campana_id', inv.campana_id,
                              'nombre', camp.datos->>'nombre', 'ya_estaba', true);
  end if;

  insert into public.miembros_campana (campana_id, usuario, papel)
  values (inv.campana_id, auth.uid(), 'jugador');

  update public.invitaciones_campana set usos = usos + 1 where codigo = inv.codigo;

  return jsonb_build_object('ok', true, 'campana_id', inv.campana_id,
                            'nombre', camp.datos->>'nombre', 'ya_estaba', false);
end;
$$;

-- Crear un código. Lo genera el servidor, no el navegador: así no hay forma de fabricarse
-- uno «bonito» que colisione con el de otra mesa, y el formato es siempre el mismo.
create or replace function public.crear_invitacion(
  id_campana text,
  dias_validez integer default 30,
  usos integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo text;
  intentos integer := 0;
begin
  if not public.soy_master_de(id_campana) then
    return jsonb_build_object('ok', false, 'error', 'Sólo el máster de la campaña puede invitar.');
  end if;

  loop
    -- Seis caracteres sin las letras que se confunden al dictar por voz (I, O, 0, 1).
    nuevo := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                               1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.invitaciones_campana where codigo = nuevo);
    intentos := intentos + 1;
    if intentos > 20 then
      return jsonb_build_object('ok', false, 'error', 'No se ha podido generar un código. Inténtalo otra vez.');
    end if;
  end loop;

  insert into public.invitaciones_campana (codigo, campana_id, creada_por, caduca_en, usos_maximos)
  values (
    nuevo,
    id_campana,
    auth.uid(),
    case when dias_validez is null or dias_validez <= 0 then null
         else now() + make_interval(days => dias_validez) end,
    greatest(1, coalesce(usos, 20))
  );

  return jsonb_build_object('ok', true, 'codigo', nuevo);
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ARCHIVOS (Storage)
--
-- Un bucket privado para las imágenes. Privado quiere decir que la URL no basta: cada
-- descarga pasa por las políticas de abajo. La ruta es `{uid}/{id}.webp`, y la primera
-- carpeta —el uid del dueño— es lo que miran las políticas para decidir.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', false, 10485760,
        array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif'];

-- Poder ver el archivo tiene que significar lo mismo que poder ver su fila. Si no, un mapa
-- se podría descargar esquivando la tabla, que es justo el fallo que se quiere evitar.
create or replace function public.puedo_ver_archivo(ruta_archivo text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.imagenes i
    where i.ruta = ruta_archivo
      and not i.borrado
      and (
        i.propietario = auth.uid()
        or (i.campana_id is not null
            and (public.soy_master_de(i.campana_id) or public.soy_miembro_de(i.campana_id)))
      )
  );
$$;

drop policy if exists "imagenes_archivo_leer" on storage.objects;
create policy "imagenes_archivo_leer" on storage.objects for select
  using (
    bucket_id = 'imagenes'
    and (
      -- Lo mío siempre, aunque la fila aún no exista (se sube el archivo y luego la ficha).
      (storage.foldername(name))[1] = auth.uid()::text
      or public.puedo_ver_archivo(name)
    )
  );

drop policy if exists "imagenes_archivo_subir" on storage.objects;
create policy "imagenes_archivo_subir" on storage.objects for insert
  with check (bucket_id = 'imagenes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "imagenes_archivo_editar" on storage.objects;
create policy "imagenes_archivo_editar" on storage.objects for update
  using (bucket_id = 'imagenes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'imagenes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "imagenes_archivo_borrar" on storage.objects;
create policy "imagenes_archivo_borrar" on storage.objects for delete
  using (bucket_id = 'imagenes' and (storage.foldername(name))[1] = auth.uid()::text);


-- ── El catálogo ─────────────────────────────────────────────────────────────
--
-- Aquí está lo que pediste: **lo de los manuales no se puede borrar**. A las filas
-- oficiales se les da política de `select` y nada más. Con Row Level Security activo, lo
-- que no tiene política está prohibido, así que ni update ni delete existen para ellas:
-- no hay forma de tocarlas desde el navegador, ni por error ni a propósito. Sólo la clave
-- `service_role` —la que nunca se pone en el `.env.local`— puede sembrarlas, que es
-- justamente lo que hace `supabase/catalogo-oficial.sql`.

-- Saber si un paquete es mío, sin repetir la subconsulta en cada política.
create or replace function public.puedo_editar_paquete(id_paquete text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.paquetes p
    where p.id = id_paquete
      and not p.oficial
      and (p.propietario = auth.uid() or public.soy_master_de(p.campana_id))
  );
$$;

drop policy if exists "paquetes_leer" on public.paquetes;
create policy "paquetes_leer" on public.paquetes for select
  using (
    -- Los manuales los ve todo el mundo: son el catálogo común.
    oficial
    or propietario = auth.uid()
    -- Y el paquete de una mesa lo ve quien juega en ella.
    or (campana_id is not null and public.soy_miembro_de(campana_id))
    or (campana_id is not null and public.soy_master_de(campana_id))
  );

drop policy if exists "paquetes_crear" on public.paquetes;
create policy "paquetes_crear" on public.paquetes for insert
  with check (not oficial and propietario = auth.uid());

drop policy if exists "paquetes_editar" on public.paquetes;
create policy "paquetes_editar" on public.paquetes for update
  using (not oficial and propietario = auth.uid())
  -- El `with check` impide el truco de marcarse un paquete propio como oficial y colarlo
  -- en el catálogo de todos.
  with check (not oficial and propietario = auth.uid());

drop policy if exists "paquetes_borrar" on public.paquetes;
create policy "paquetes_borrar" on public.paquetes for delete
  using (not oficial and propietario = auth.uid());

-- Nótese que no hay «paquetes_borrar_oficial» ni «paquetes_editar_oficial». No es un
-- olvido: es la protección.

drop policy if exists "catalogo_leer" on public.catalogo;
create policy "catalogo_leer" on public.catalogo for select
  using (
    exists (
      select 1 from public.paquetes p
      where p.id = catalogo.paquete_id
        and (
          p.oficial
          or p.propietario = auth.uid()
          or (p.campana_id is not null and public.soy_miembro_de(p.campana_id))
          or (p.campana_id is not null and public.soy_master_de(p.campana_id))
        )
    )
  );

drop policy if exists "catalogo_crear" on public.catalogo;
create policy "catalogo_crear" on public.catalogo for insert
  with check (public.puedo_editar_paquete(paquete_id));

drop policy if exists "catalogo_editar" on public.catalogo;
create policy "catalogo_editar" on public.catalogo for update
  using (public.puedo_editar_paquete(paquete_id))
  with check (public.puedo_editar_paquete(paquete_id));

drop policy if exists "catalogo_borrar" on public.catalogo;
create policy "catalogo_borrar" on public.catalogo for delete
  using (public.puedo_editar_paquete(paquete_id));


-- ── Las cuatro tablas de la campaña ─────────────────────────────────────────
--
-- Mismo criterio que la campaña de la que cuelgan: el máster manda y los jugadores leen.
-- El diario es la excepción: lo escribe la mesa, porque las notas de sesión las toma
-- quien las toma.

drop policy if exists "manuales_campana_leer" on public.manuales_campana;
create policy "manuales_campana_leer" on public.manuales_campana for select
  using (public.soy_master_de(campana_id) or public.soy_miembro_de(campana_id));

drop policy if exists "manuales_campana_escribir" on public.manuales_campana;
create policy "manuales_campana_escribir" on public.manuales_campana for all
  using (public.soy_master_de(campana_id))
  with check (public.soy_master_de(campana_id));

drop policy if exists "ajustes_campana_leer" on public.ajustes_campana;
create policy "ajustes_campana_leer" on public.ajustes_campana for select
  using (public.soy_master_de(campana_id) or public.soy_miembro_de(campana_id));

drop policy if exists "ajustes_campana_escribir" on public.ajustes_campana;
create policy "ajustes_campana_escribir" on public.ajustes_campana for all
  using (public.soy_master_de(campana_id))
  with check (public.soy_master_de(campana_id));

drop policy if exists "reglas_campana_leer" on public.reglas_campana;
create policy "reglas_campana_leer" on public.reglas_campana for select
  using (public.soy_master_de(campana_id) or public.soy_miembro_de(campana_id));

drop policy if exists "reglas_campana_escribir" on public.reglas_campana;
create policy "reglas_campana_escribir" on public.reglas_campana for all
  using (public.soy_master_de(campana_id))
  with check (public.soy_master_de(campana_id));

drop policy if exists "diario_campana_leer" on public.diario_campana;
create policy "diario_campana_leer" on public.diario_campana for select
  using (public.soy_master_de(campana_id) or public.soy_miembro_de(campana_id));

drop policy if exists "diario_campana_crear" on public.diario_campana;
create policy "diario_campana_crear" on public.diario_campana for insert
  with check (
    (public.soy_master_de(campana_id) or public.soy_miembro_de(campana_id))
    and escrita_por = auth.uid()
  );

drop policy if exists "diario_campana_editar" on public.diario_campana;
create policy "diario_campana_editar" on public.diario_campana for update
  using (escrita_por = auth.uid() or public.soy_master_de(campana_id))
  with check (escrita_por = auth.uid() or public.soy_master_de(campana_id));

drop policy if exists "diario_campana_borrar" on public.diario_campana;
create policy "diario_campana_borrar" on public.diario_campana for delete
  using (escrita_por = auth.uid() or public.soy_master_de(campana_id));


-- ─────────────────────────────────────────────────────────────────────────────
-- COMPROBACIÓN
--
-- Esto debe devolver `true` en las quince tablas. Si alguna sale `false`, esa tabla está
-- abierta a cualquiera que tenga la URL del proyecto — que es pública.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- select relname, relrowsecurity from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r'
-- order by relname;
--
-- Y que el contenido de los manuales sea de sólo lectura. Estas dos consultas no deben
-- devolver **ninguna** política de update ni de delete sobre filas oficiales:
--
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename in ('paquetes', 'catalogo')
-- order by tablename, cmd;
--
-- La prueba de verdad es intentarlo desde la aplicación, con una sesión normal:
--
--   delete from catalogo;          -- debe borrar 0 filas
--   update catalogo set borrado = true;   -- debe tocar 0 filas
--
-- Y que el bucket no sea público:
--
-- select id, public from storage.buckets where id = 'imagenes';
