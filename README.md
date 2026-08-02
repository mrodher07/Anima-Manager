# Anima Manager

Aplicación para llevar el control de partidas del juego de rol
**Anima: Beyond Fantasy**: creación de personajes, fichas y gestión de campañas.

Funciona igual en ordenador y en móvil, con cuatro temas visuales: **oscuro** (por
defecto), **claro**, **steampunk** y **medieval**.

## Instalación

Sólo hace falta **Node.js 20 o superior** ([nodejs.org](https://nodejs.org), la versión LTS
sirve). No hay base de datos, ni servidor, ni cuenta que crear: todo vive en el navegador.

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
  navegador se van. Para mover o respaldar una ficha, usa **exportar/importar** desde la
  pestaña Personajes: en JSON (formato propio, incluye el retrato) o en Excel.

### Otros comandos

```bash
npm test         # 352 pruebas del motor de reglas
npm run build    # compilar (incluye la comprobación de tipos)
```

## Qué hace

| Sección | Para qué |
|---|---|
| **Personajes** | Lista de fichas, crear, exportar e importar en JSON y en Excel |
| **Ficha** | Vista de consulta con recursos, características, resistencias, combate y secundarias |
| **Editar** | Identidad, características, ventajas, habilidades, equipo y poderes |
| **Mesa** | Jugar: gastar recursos, tirar iniciativa, resolver ataques, tiradas rápidas |
| **Bestiario** | Fichas de enemigo con imagen; 90 criaturas importables de los manuales |
| **Lo sobrenatural** | Invocaciones, Encarnaciones, Teoremas, Nodos, rituales y grimorios, con sus calculadoras |
| **Contenido propio** | Las 26 colecciones del catálogo, personalizables por tu mesa |
| **Galería** | Mapas, PNJs, enemigos y objetos en imágenes |
| **Campañas** | Reglas caseras, manuales activos y diario de sesiones |
| **Reglas** | Reescribir o desactivar cualquier fórmula, y restablecerla |

## Cómo está montado

```
data/reglas/     Catálogo del Core Exxet, el Dominus y el Arcana (~3.400 registros)
data/arcana/     Paquete aparte: Teoremas, Invocaciones, Encarnaciones, rituales y grimorios
data/los-que-caminaron/  Paquete aparte: razas, Sellos por criatura y bestiario
docs/            Análisis de la ficha original y fórmulas verificadas
src/motor/       Motor de reglas. Funciones puras, sin interfaz
  expresiones.ts   Evaluador acotado para las fórmulas (sin eval)
  reglamento.ts    Catálogo de reglas configurable por mesa
  personaje.ts     Modelo de ficha y derivación de valores
  combate.ts       Armadura, armas y resolución de asaltos
  dados.ts         d100 con tiradas abiertas y pifias
src/datos/       Paquetes de contenido combinables (un manual = un paquete)
src/almacen/     Persistencia en IndexedDB, exportar e importar
  xlsx.ts          Leer y escribir .xlsx sin dependencias
  fichaExcel.ts    Traducción entre la ficha y el libro de Excel
src/ui/          Interfaz React
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

Las fórmulas se evalúan con un intérprete propio y acotado — **nunca con `eval`**. Cuando
llegue la sincronización, una fórmula escrita por un jugador se ejecutaría en el navegador
del máster al abrir su ficha.

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
`eval`: la aplicación tiene dos dependencias y no parecía buena idea que el navegador del
máster ejecutase miles de líneas de terceros para abrir una ficha.

## Imágenes

Se guardan en su propio almacén de IndexedDB, no dentro de la ficha, así que un personaje
sigue pesando unos kilobytes. Al subirlas se **reescalan y se convierten a WebP** (1600 px
de lado para mapas, 640 para retratos): una foto de móvil de 5 MB llenaría la cuota del
navegador en pocas subidas.

Al exportar una ficha, **su retrato viaja con ella** como data URI, para que llegue
completa a quien la reciba. Si el navegador se queda sin espacio, la aplicación lo dice en
lugar de fallar en silencio.

## Qué falta

Está anotado al final de `docs/FORMULAS-VERIFICADAS.md`. En resumen:

- Del **Arcana Exxet** queda sólo el editor de Sheele en la ficha.
- De **Los que Caminaron con Nosotros** quedan los poderes nuevos de criatura y las reglas
  de Combate de Masas y Combate Dramático.
- De las 292 ventajas, 74 modifican la ficha solas; el resto se eligen igual y las que
  tienen efecto no automatizable lo muestran como recordatorio.

## Manuales incorporados

| Manual | Qué aporta |
|---|---|
| **Core Exxet** | Todo el básico: razas, categorías, ventajas, habilidades, equipo, magia y psíquica |
| **Dominus Exxet** | Ki completo: puntos, acumulación, Habilidades, Límites, creador de Técnicas, Legados de Sangre y Sellos de Invocación |
| **Arcana Exxet** | Nivel de Magia, Metamagia, Sheele, Teoremas, Invocaciones, Encarnaciones, rituales, grimorios y Nodos |
| **Los que Caminaron con Nosotros** | Paquete activable por campaña: Razas Perdidas, Sellos de 99 criaturas y un bestiario de 90 |

## Regenerar el catálogo

```bash
pip install openpyxl
cp Meirmeister.xlsm tools/ficha.xlsm
python3 tools/extraer-tablas.py
```
