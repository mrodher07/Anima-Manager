# Anima Manager

Aplicación para llevar el control de partidas del juego de rol
**Anima: Beyond Fantasy**: creación de personajes, fichas y gestión de campañas.

Funciona igual en ordenador y en móvil, con cuatro temas visuales: **oscuro** (por
defecto), **claro**, **steampunk** y **medieval**.

## Instalación

Sólo hace falta **Node.js 20 o superior** ([nodejs.org](https://nodejs.org), la versión LTS
sirve). No hay base de datos, ni servidor, ni cuenta que crear: todo vive en el navegador.
(Si quieres cuentas y sincronizar entre dispositivos, eso se añade aparte y es opcional:
[Cuentas y nube](#cuentas-y-nube-opcional).)

```bash
git clone https://github.com/mrodher07/Anima-Manager.git
cd Anima-Manager
npm install
npm run dev
```

`npm run dev` imprime una dirección (`http://localhost:5173`). Ábrela en el navegador y ya
está.

### Para usarla también desde el móvil

En la misma red (tu wifi de casa), arranca con `--host` para que el servidor acepte
conexiones desde otros equipos:

```bash
npm run dev -- --host
```

Ahora imprime **dos** direcciones; la de `Network:` (algo como `http://192.168.1.40:5173`)
es la que se abre desde el móvil o desde el portátil de otro jugador.

### Para dejarla montada de forma estable

Compilar deja una web estática en `dist/`, que ya no necesita Node para funcionar:

```bash
npm run build
npm run preview -- --host    # para probarla
```

El contenido de `dist/` se puede servir con cualquier cosa —`python3 -m http.server`, nginx,
Netlify, GitHub Pages— o copiarse a un disco y abrirse desde ahí.

### Dónde se guardan tus datos

En el **IndexedDB del navegador**, en el dispositivo donde la abres. Eso significa:

- Funciona **sin internet** una vez cargada.
- Nadie más ve tus campañas: no salen del equipo.
- Pero **no se sincronizan solas** entre el PC y el móvil, y si borras los datos del
  navegador se van.

Por eso hay una pestaña **Copia de seguridad**: guárdala de vez en cuando y no dependerás de
este equipo. Para mover una ficha suelta a otro sitio, usa exportar/importar desde la pestaña
Personajes, en JSON o en Excel.

Si además quieres **cuentas y sincronización** entre dispositivos, mira
[Cuentas y nube](#cuentas-y-nube-opcional). Es opcional: sin configurarla, todo lo de arriba
sigue igual.

### Otros comandos

```bash
npm test         # 485 pruebas del motor de reglas y la sincronización
npm run build    # compilar (incluye la comprobación de tipos)
```

## Qué hace

| Sección | Para qué |
|---|---|
| **Personajes** | Lista de fichas, crear, exportar e importar en JSON y en Excel |
| **Ficha** | Vista de consulta con recursos, características, resistencias, combate y secundarias |
| **Editar** | Identidad, características, ventajas, habilidades, equipo y poderes |
| **Mesa** | Jugar: gastar recursos, tirar iniciativa, resolver ataques, Combate de Masas |
| **Bestiario** | Fichas de enemigo con imagen; 90 criaturas importables de los manuales |
| **Lo sobrenatural** | Invocaciones, Encarnaciones, Teoremas, Nodos, rituales y grimorios, con sus calculadoras |
| **Contenido propio** | Las 26 colecciones del catálogo, personalizables por tu mesa |
| **Galería** | Mapas, PNJs, enemigos y objetos en imágenes |
| **Campañas** | Crear la mesa, invitar jugadores, nivel de inicio, manuales, reglas caseras y diario |
| **Reglas** | Reescribir o desactivar cualquier fórmula, y restablecerla |
| **Copia de seguridad** | Guardar y restaurar **todo** lo de este dispositivo |
| **Cuenta** | Registro y sincronización entre dispositivos, si la nube está configurada |

## Cómo está montado

```
data/reglas/     Catálogo del Core Exxet, el Dominus y el Arcana (~3.400 registros)
data/arcana/     Paquete aparte: Teoremas, Invocaciones, Encarnaciones, rituales y grimorios
data/los-que-caminaron/  Paquete aparte: razas, Sellos, bestiario y poderes de criatura
docs/            Análisis de la ficha original y fórmulas verificadas
src/motor/       Motor de reglas. Funciones puras, sin interfaz
  expresiones.ts   Evaluador acotado para las fórmulas (sin eval)
  reglamento.ts    Catálogo de reglas configurable por mesa
  personaje.ts     Modelo de ficha y derivación de valores
  combate.ts       Armadura, armas y resolución de asaltos
  combateAlternativo.ts  Combate Dramático y Combate de Masas
  sheele.ts        Espíritus del Alma: casi todo sale de su señor
  dados.ts         d100 con tiradas abiertas y pifias
src/datos/       Paquetes de contenido combinables (un manual = un paquete)
src/almacen/     Persistencia en IndexedDB, exportar e importar
  xlsx.ts          Leer y escribir .xlsx sin dependencias
  fichaExcel.ts    Traducción entre la ficha y el libro de Excel
  copiaSeguridad.ts  Copia y restauración de todo el dispositivo
src/nube/        Sincronización con Supabase, toda opcional
  fusion.ts        Qué versión gana: funciones puras, sin red ni base de datos
  sincronizacion.ts  Llevar y traer entre IndexedDB y el servidor
  imagenesNube.ts  Imágenes: la fila a la tabla, el archivo a Storage
  mesa.ts          Perfiles, preferencias, invitaciones y campañas compartidas
  cuenta.ts        Registro, sesión y sincronización periódica
src/ui/          Interfaz React
supabase/        El SQL que hay que ejecutar en el proyecto de Supabase
tools/           Extractores: el .xlsm original y los PDF de cada suplemento
```

### Cuatro decisiones que conviene conocer

**El motor no sabe nada de la interfaz.** Todo el cálculo son funciones puras: mismos
datos, mismo resultado. Eso permite verificarlo contra la ficha original — las pruebas
reconstruyen a *Meirmeister* desde cero y comprueban que salen sus valores reales.

**Las reglas son datos, no código.** Cada regla vive en `reglamento.ts` con su fórmula, su
referencia al manual y sus variables documentadas. Una mesa puede reescribir cualquier
fórmula o desactivar las opcionales, y volver a los valores por defecto cuando quiera. Se
guarda **sólo lo que cambia**, así que las correcciones futuras del reglamento oficial
llegan solas a quien no lo haya tocado.

Las fórmulas se evalúan con un intérprete propio y acotado — **nunca con `eval`**. Ahora que
hay sincronización esto ha dejado de ser una precaución teórica: una fórmula escrita por un
jugador se ejecuta en el navegador del máster en cuanto abre su ficha.

**La nube es una copia, no el sitio donde viven los datos.** Guardar escribe en IndexedDB y
devuelve el control al instante; sincronizar viene después y por su cuenta. Y lo que decide
qué versión gana (`src/nube/fusion.ts`) son funciones puras sin red ni base de datos: la
parte de una sincronización que de verdad se puede equivocar merece probarse con casos
concretos, no comprobarse a ojo abriendo la aplicación en dos móviles.

**Un manual es un paquete de contenido.** El Core Exxet es sólo el primero. Al añadir un
suplemento basta con registrar su paquete y sus JSON: sus entradas se combinan con las del
básico y pueden corregirlas, y cada entrada recuerda de qué manual viene.

**El contenido propio de una mesa es otro paquete más**, con prioridad por encima de los
manuales. Se pueden crear entradas de cualquiera de las 26 colecciones, y el editor está
dirigido por esquema (`src/datos/esquemas.ts`): describir una colección basta para poder
editarla.

**Los temas son datos.** Cada uno es un bloque de variables CSS más una entrada en
`src/ui/temas.ts`; no hay condicionales por tema repartidos por el código. Añadir uno es
escribir sus colores. Una prueba comprueba que ningún tema se deje variables sin definir, y
el contraste está verificado en los cuatro (texto por encima de 11:1).

**En el móvil, lo que se arrastra es la tira, nunca la página.** Es la regla que ordena todo
el diseño responsive. Once secciones no caben en la cabecera de un teléfono: antes se ponían
en una fila que no se partía, y el resultado era que la página entera medía mil píxeles en
una pantalla de 390 —se veía un tercio, había que arrastrar de lado para leer una frase, y
las últimas pestañas quedaban fuera del alcance del dedo. Ahora la navegación baja a su
propia fila y se desplaza dentro de sí misma, con un difuminado en el borde que avisa de que
hay más. Lo mismo con las pestañas del editor y con las tablas anchas. Nada en la aplicación
hace que la página se pueda mover a lo ancho, y hay una comprobación con navegador de verdad
que lo verifica en cuatro tamaños (375, 390, 820 y 1440) y en las once secciones.

**Los límites avisan, no bloquean.** Igual que la ficha de Excel: si te pasas de PD o de
Puntos de Creación sale un aviso, pero el cálculo sigue. Cualquier valor derivado se puede
sobrescribir a mano sin perder el calculado.

**La aplicación no juega la partida.** Esto es un juego de rol: la mitad de lo que pasa en
la mesa no es calculable, y la herramienta no debe fingir que sí. Por eso:

- La **experiencia se asigna a mano**: el manual dice explícitamente que el reparto es
  discrecional del Director (1–5 puntos según lo difícil que fuera *para ese personaje*).
- El **trasfondo** —apariencia, personalidad, motivación, historia, contactos— es texto
  libre. No se valida ni se puntúa.
- El **diario de campaña** guarda lo que pasó en cada sesión, con vuestras palabras.
- La **galería** guarda mapas, PNJs y enemigos como imágenes, sin obligar a fichar nada.
- Las tiradas se pueden hacer con la app o con dados de verdad y anotar el resultado: los
  recursos se ajustan a mano con los botones de ±1/±5/±10.

## Copia de seguridad

Exportar una ficha sirve para **compartirla**. La copia de seguridad es otra cosa: sirve para
**no perder nada**. Se lleva todo lo que hay en el dispositivo —fichas, campañas con sus
reglas caseras, su contenido propio y su diario, enemigos, la galería entera con sus imágenes
dentro, y hasta el tema que tengas puesto— y lo devuelve tal cual estaba.

Al restaurar se enseña primero **qué trae el archivo** y se elige cómo entra:

- **Fusionar**: devuelve lo de la copia sin borrar nada de lo que ya tengas. Lo que coincida
  por id se sustituye por lo de la copia, que es lo que se espera de una restauración.
- **Reemplazar todo**: borra lo que hay y deja el dispositivo exactamente como estaba el día
  de la copia. Pide confirmación aparte y dice cuántas cosas va a borrar antes de hacerlo.

Si una imagen viniera dañada se anota y el resto se restaura igual: perder un mapa no es
motivo para dejar las fichas a medias.

## Cuentas y nube (opcional)

Con una cuenta puedes abrir tus fichas desde el móvil y desde el ordenador, y tu máster ve
las de su campaña. **Es opcional**: sin configurar nada, la aplicación funciona exactamente
igual que siempre, en local.

### Cómo está pensado

**Local-first.** Guardar una ficha escribe en IndexedDB y devuelve el control al instante;
la nube se entera después. Si no hay conexión, o el servidor está caído, o directamente no
hay cuenta, se sigue jugando igual. La nube es una copia, no el sitio donde viven los datos.

Se sincroniza sola al entrar, cada tres minutos, al volver la conexión y al volver a la
pestaña. Y hay un botón, por si tienes prisa.

**Quién ve qué:**

| | Lo ve | Lo edita |
|---|---|---|
| Tus fichas | tú y el máster de tu campaña | sólo tú |
| Tus campañas | tú y quienes juegan en ellas | sólo tú |
| Tu bestiario | sólo tú | sólo tú |
| Imágenes de una campaña | toda esa mesa | sólo quien las subió |
| Imágenes sin campaña | sólo tú | sólo tú |
| Tu nombre visible | quien comparte mesa contigo | sólo tú |
| Tu correo | nadie más que tú | — |

Que el máster **no** pueda editar las fichas de sus jugadores es una decisión, no un
descuido: la ficha de un jugador es suya. Si tu mesa lo prefiere al revés, hay una línea
comentada en `supabase/esquema.sql` que lo cambia.

### Qué tablas hay

| Tabla | Qué guarda |
|---|---|
| `perfiles` | El nombre visible de cada usuario. Se crea solo al registrarse |
| `campanas` | La mesa entera: reglas caseras, manuales activos, diario y contenido propio |
| `miembros_campana` | Quién juega en cada campaña |
| `invitaciones_campana` | Los códigos para unirse a una mesa |
| `personajes` | Las fichas |
| `enemigos` | El bestiario del máster |
| `imagenes` | La ficha técnica de cada imagen; el archivo va al bucket `imagenes` |
| `preferencias` | El tema y lo que vaya haciendo falta, por usuario |

Fichas, campañas y enemigos se guardan como **un jsonb entero**, no como columnas: el modelo
crece cada vez que llega un manual nuevo, y con columnas cada suplemento sería una migración.
Sólo se sacan a columna los campos por los que se consulta —dueño, campaña, fecha.

### Montar una campaña

Al crear una campaña se pregunta de una vez todo lo que se decide en una sesión cero, con
los valores del manual básico ya puestos —si tu mesa juega estándar, con el nombre basta:

| | Por defecto | Para qué |
|---|---|---|
| **Nivel de inicio** | 1 | Los PD de partida: 400 a nivel 0, 600 a nivel 1, +100 por nivel. Las fichas creadas en la campaña nacen con él |
| **Puntos de Creación** | 3 | Subirlos es lo que hace una campaña más heroica |
| **Tope por desventajas** | 3 | Evita cargarse de defectos para comprarlo todo |
| **Sistema de combate** | Normal | Normal o Dramático |
| **Manuales** | Core Exxet | Los paquetes de contenido activos |

Estas cifras **no son decorativas**: llegan a la ficha. Si tu mesa da 5 Puntos de Creación,
el contador de la pestaña Ventajas dice 5 y deja de avisar al cuarto.

### Unirse a una mesa

El máster genera un código en **Campañas → Invitaciones** y se lo pasa a sus jugadores, que
lo canjean en **Cuenta → Unirte a una mesa**. Los códigos caducan a los 30 días y tienen un
número limitado de usos; si uno se escapa por un chat, se borra y se genera otro sin echar a
nadie.

Hace falta un código y no basta con el id de la campaña porque ese id **viaja dentro de cada
ficha exportada**: cualquiera que hubiera visto una ficha podría haberse metido en la mesa y
leído las del resto.

Al unirte recibes la campaña de tu máster en **sólo lectura**. No es un adorno: la campaña
lleva las reglas caseras y los manuales activos, y la misma ficha calculada con el reglamento
por defecto no da los mismos números.

### Montarlo

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, pega entero `supabase/esquema.sql` y ejecútalo. Crea las ocho
   tablas, el bucket de imágenes y —lo importante— las políticas de acceso.
3. **Project Settings → API**: copia la *Project URL* y la clave *anon public*.
4. `cp .env.example .env.local` y rellena esos dos valores.
5. `npm run dev`. Aparece la pestaña **Cuenta**.

Si lo despliegas en Vercel, las mismas dos variables van en **Settings → Environment
Variables** (y hay que volver a desplegar: Vite las incrusta al compilar, no las lee en
tiempo de ejecución).

Por defecto Supabase pide confirmar el correo antes de dejar entrar. Para pruebas se puede
quitar en **Authentication → Providers → Email**.

### Lo que conviene saber antes de fiarte

- **La clave `anon` es pública.** Va dentro del JavaScript que se descarga cualquiera. Lo
  único que impide que un usuario lea los datos de otro son las políticas del paso 2. Si te
  saltas ese paso, la base de datos queda abierta. El propio archivo trae al final una
  consulta para comprobar que Row Level Security está activo en las ocho tablas.
- **Las imágenes ocupan.** El plan gratuito de Supabase da 1 GB de Storage. La aplicación ya
  reescala y convierte a WebP antes de subir (1600 px de lado para mapas, 640 para retratos),
  así que una imagen ronda las decenas de kilobytes y hacen falta muchas partidas para
  llenarlo — pero conviene saber que ese límite existe.
- **Gana la última versión guardada.** Si editas la misma ficha en dos dispositivos sin
  conexión, cuando ambos sincronicen se queda la que se guardó más tarde y la otra se pierde.
  Es la resolución de conflictos más simple que existe, y es suficiente porque cada ficha
  tiene un dueño que la edita. Fusionar campo a campo multiplicaría la complejidad para un
  problema que en una mesa de rol casi no aparece.
- **Borrar deja lápida.** Al borrar no se quita la fila, se marca. Sin eso, una ficha borrada
  en el móvil reaparecería en la siguiente sincronización desde el portátil, que todavía la
  tiene.
- **La copia de seguridad no sobra.** Sigue siendo lo único que te protege de borrar algo por
  error, porque el borrado sí se sincroniza. La nube te protege de perder el dispositivo; la
  copia, de equivocarte.

### Salir de la cuenta no borra nada

Lo que hay en el dispositivo se queda. La aplicación vuelve a ser lo que era antes de
registrarse.

## Sistemas de combate

Cada campaña elige el suyo en la pestaña **Campañas**, antes de empezar:

- **Normal**: cada asalto dura tres segundos, como siempre.
- **Combate Dramático**: no cambia ninguna regla, sólo estira el asalto para que un duelo
  entre leyendas se sienta épico. El primero dura tres segundos y a partir de ahí se dobla —
  6, 12, 24— hasta quedarse en un minuto desde el quinto. Se elige aquí y no en mitad de la
  partida porque el manual pide que todos lo sepan desde el principio del combate.

El **Combate de Masas** no hace falta activarlo: está siempre en la pestaña Mesa. Convierte
un ejército entero en un solo contrincante con acumulación de daño, y calcula su aguante,
su bono al ataque según cuántos son, cuántos van cayendo, el multiplicador de un ataque en
área y qué le hace un conjuro que cubra terreno.

## Excel

Cada ficha se puede bajar como **.xlsx** y volver a subir. El libro tiene dos naturalezas a
la vez, y es a propósito:

- Siete hojas **para leer** —identidad, características, combate, habilidades, ventajas y
  poderes, equipo y trasfondo— con los valores ya calculados. Es lo que se imprime o se
  manda por correo, y se puede editar a mano sin saber nada del formato.
- Una hoja llamada `anima-manager` con la ficha entera en JSON. Al reimportar se lee esa y
  **no se pierde nada**: ni los PD invertidos, ni los bonos especiales, ni las
  sobrescrituras manuales, ni el estado de juego. Si el libro no la trae, se reconstruye de
  las hojas legibles avisando de qué se ha quedado fuera.

También se puede importar **la hoja de cálculo que ya usa la comunidad** (Meirmeister y sus
derivadas). De ahí se traen la identidad, la categoría, el nivel y las ocho características
compradas; el resto hay que repasarlo a mano, porque en esa hoja vive dentro de fórmulas y
no se puede identificar sin riesgo de inventarse datos. Se busca **por etiqueta**, no por
dirección de celda, para que aguante las distintas versiones que circulan.

Leer y escribir .xlsx está hecho **sin dependencias**: un .xlsx es un ZIP con XML, y hacen
falta un CRC32, un ZIP sin comprimir y `DecompressionStream`, que ya traen el navegador y
Node. Es el mismo criterio que llevó a escribir el evaluador de fórmulas en lugar de usar
`eval`: la aplicación tiene tres dependencias —React, React DOM y el cliente de Supabase, y
esta última sólo si se usa la nube— y no parecía buena idea que el navegador del máster
ejecutase miles de líneas de terceros para abrir una ficha.

## Imágenes

Se guardan en su propio almacén de IndexedDB, no dentro de la ficha, así que un personaje
sigue pesando unos kilobytes. Al subirlas se **reescalan y se convierten a WebP** (1600 px
de lado para mapas, 640 para retratos): una foto de móvil de 5 MB llenaría la cuota del
navegador en pocas subidas.

Al exportar una ficha, **su retrato viaja con ella** como data URI, para que llegue
completa a quien la reciba. Si el navegador se queda sin espacio, la aplicación lo dice en
lugar de fallar en silencio.

Con nube configurada también se sincronizan: la ficha técnica va a la tabla `imagenes` y el
archivo al bucket privado, en `{tu-id}/{id}.webp`. Esa ruta no es decoración — las políticas
de Storage miran la primera carpeta para saber de quién es el archivo, así que la estructura
**es** el permiso. Al subir se manda primero el archivo y después la fila, y al borrar
justo al revés: si algo se corta a medias, lo que queda es un archivo huérfano —basura
invisible— y nunca un mapa anunciado que ya no se puede descargar.

## Qué falta

Está anotado al final de `docs/FORMULAS-VERIFICADAS.md`. En resumen:

Los cuatro manuales están completos. Lo único que sigue sin automatizarse por decisión
propia: de las 292 ventajas, 74 modifican la ficha solas; el resto se eligen igual y las que
tienen un efecto no automatizable lo muestran como recordatorio en vez de fingir que se
aplican.

De la nube no queda nada esencial pendiente: fichas, campañas, bestiario, imágenes,
preferencias y perfiles se sincronizan. Lo que sigue siendo un límite consciente es la
resolución de conflictos —gana el último que guardó— y que el diario de campaña viaja dentro
del documento de la campaña, así que dos ediciones simultáneas del máster desde dos
dispositivos sin conexión se pisarían.

## Manuales incorporados

| Manual | Qué aporta |
|---|---|
| **Core Exxet** | Todo el básico: razas, categorías, ventajas, habilidades, equipo, magia y psíquica |
| **Dominus Exxet** | Ki completo: puntos, acumulación, Habilidades, Límites, creador de Técnicas, Legados de Sangre y Sellos de Invocación |
| **Arcana Exxet** | Nivel de Magia, Metamagia, Sheele, Teoremas, Invocaciones, Encarnaciones, rituales, grimorios y Nodos |
| **Los que Caminaron con Nosotros** | Paquete activable por campaña: Razas Perdidas, Sellos de 99 criaturas, un bestiario de 90 y 85 poderes de criatura |

## Regenerar el catálogo

```bash
pip install openpyxl
cp Meirmeister.xlsm tools/ficha.xlsm
python3 tools/extraer-tablas.py
```
