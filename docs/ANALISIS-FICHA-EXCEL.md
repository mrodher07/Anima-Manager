# Análisis de la ficha `Meirmeister.xlsm` — Anima Beyond Fantasy

> **Para mí mismo en otra sesión.** Este documento resume todo lo que se ha extraído del
> Excel que aportó el usuario y el contexto del proyecto. Si retomo el trabajo sin memoria
> de la conversación, esto y `data/reglas/*.json` son la fuente de verdad.

---

## 1. Contexto del proyecto

**Objetivo del usuario:** una aplicación **React** para llevar el control de partidas del
juego de rol **Anima Beyond Fantasy**.

Requisitos declarados hasta ahora:

- **React**, responsive: debe funcionar igual de bien en PC y en móvil.
- **Estilo atractivo** orientado a aficionados a este tipo de juegos (fantasía oscura,
  estética del propio Anima).
- **Creación de personajes** siguiendo las reglas, tomando como referencia la ficha Excel.
- **Sencilla e intuitiva** de usar, a pesar de la complejidad del sistema.
- Gestión de **partidas/campañas**, no sólo de personajes sueltos.

El usuario avisará cuándo empezar a construir la app. El trabajo hecho hasta ahora es de
análisis y extracción de datos.

### Decisiones tomadas (sesión de análisis)

| Decisión | Elección |
|---|---|
| **Alcance v1** | Todo a la vez: fichas + modo mesa de juego + gestión de campaña |
| **Persistencia** | Local primero (IndexedDB + export/import JSON), con el modelo de datos preparado para sincronizar en la nube después |
| **Automatización de reglas** | Automática pero editable: se calcula todo y se avisa en rojo al pasarse de PDs o de límites, pero cualquier valor se puede sobrescribir a mano (igual que el Excel) |
| **Usuarios** | Máster y jugadores, cada jugador con su ficha y el máster viendo el grupo |

> **Tensión conocida:** "máster y jugadores" exige compartir datos entre dispositivos, y
> eso sólo se resuelve de verdad con el backend de la fase 2. Hasta entonces, compartir
> será por exportar/importar JSON. El modelo de datos debe llevar desde el principio
> `id`, `propietario` y `actualizadoEn` para que la sincronización posterior no obligue a
> migrar fichas.

---

## 2. Qué es la ficha aportada

Es la **ficha comunitaria "Meirmeister"**, una hoja de cálculo con macros VBA
(`vbaProject.bin`, ~227 KB) que automatiza casi todo el sistema de Anima. Es *el* estándar
de facto en la comunidad hispana para llevar personajes de Anima.

- 21 hojas (13 visibles, 5 ocultas de tablas, 3 de grimorios).
- ~460 nombres definidos (rangos con nombre) usados por fórmulas y macros.
- Controles ActiveX (botones, desplegables) — de ahí los `.bin` de `xl/activeX/`.
- El personaje de ejemplo cargado es *Meirmeister*, Jayán, Paladín Oscuro (RD), nivel 1+1.

### Hojas

| Hoja | Contenido |
|---|---|
| `Resumen` | Vista compacta imprimible de todo el personaje |
| `General` | Datos personales, trasfondo, equipo, dinero, fama, salud mental |
| `Principal` | Características, resistencias, PV, turno, secundarias, ventajas/desventajas, idiomas |
| `PDs` | Reparto de Puntos de Desarrollo por categoría y nivel — **el motor de reglas** |
| `Combate` | Armas, armadura, TA, cálculo de ataque/parada/esquiva/daño |
| `Ki` | Puntos y acumulaciones de Ki, dominios, técnicas, sellos, límites |
| `Creación de Técnicas` | Constructor de técnicas de Ki (353 filas de lógica) |
| `Místicos` | Zeón, vías, conjuros, invocaciones, teoremas de magia |
| `Metamagia` | Árbol de habilidades metamágicas por nivel |
| `Sheele` | Sheele vinculada (compañero espiritual) con ficha propia reducida |
| `Psíquicos` | CVs, disciplinas, poderes psíquicos, patrones mentales |
| `Elan` | Elan con los Señores (Mikael, Gabriel, Azrael, Erebus…) |
| `Personalización` | Reglas caseras / ajustes manuales |
| `Tablas` (oculta) | **Tabla maestra de reglas**: razas, categorías, ventajas, armas, armaduras, artes marciales, Ars Magnus, poderes de criatura, Elan… |
| `Tablas Técnicas`, `Tablas Magia`, `Tablas Sheele`, `Tablas psiquica` (ocultas) | Datos de técnicas, conjuros, mejoras de Sheele y poderes psíquicos |
| `Grimorio Magia`, `Grimorio de Vía`, `Grimorio Psíquica` | Listados imprimibles de conjuros/poderes seleccionados |

---

## 3. Modelo de reglas deducido

### 3.1 Características

Ocho características: **AGI, CON, DES, FUE, INT, PER, POD, VOL**. Valor 1–20.

> **Corrección:** los **Puntos de Creación (PC) son 3**, y sirven para comprar
> **ventajas**, no características. Se consiguen más cogiendo desventajas. Los "60 pts"
> que aparecen junto a Características en la hoja son un método alternativo de reparto
> por compra, distinto de los PC. Confirmado en el Core Exxet, cap. 1.

Cada valor da un **bono** y un **multiplicador de PV**
(`data/reglas/tablasBase.json` → `bonoCaracteristica`):

| Valor | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 15 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bono | -30 | -20 | -10 | -5 | 0 | 5 | 5 | 10 | 10 | 15 | 20 | 20 | 30 | 45 |

`valoresBase` tabula los **PV base** por valor de CON, pero la fórmula real es
`20 + CON×10 + Bono_CON` (equivalente). El **Cansancio** es simplemente `CON + modificador
racial`, no la 3.ª columna de esa tabla. Ver `docs/FORMULAS-VERIFICADAS.md`.

### 3.2 Raza

`data/reglas/razas.json` (21 entradas: humanos, Sylvain, Jayán, D'Anjayni, Ebudan, Daimah,
Duk'zarist, Devah, Vetala, Tuan Dalyr, Turak, sus variantes Nephilim, y "Criatura").

Cada raza aporta: modificadores a **RF/RE/RV/RM/RP**, **ajuste de nivel**, modificadores a
las 8 características, **tamaño**, **regeneración**, **cansancio**, **natura** y una lista
de capacidades raciales en texto.

Ejemplo Jayán: RF +15, RM −10, FUE +1, tamaño +5, regeneración +3, ajuste de nivel +1.

### 3.3 Categoría (clase)

`data/reglas/categorias.json` (22 categorías: Guerrero, Paladín, Paladín Oscuro, Tao,
Explorador, Sombra, Ladrón, Asesino, Hechicero, Warlock, Ilusionista, Conjurador,
Mentalista, Novel…).

Cada categoría define **83 campos**, agrupados en:

1. **Bonos fijos por nivel**: turno, PV, conocimiento marcial, bonos a HA/HP/HE/Llevar
   Armadura, Zeón.
2. **Límites de reparto de PDs**: `limiteCombate`, `limiteMagia`, `limitePsi`
   (fracciones: 0.6 / 0.5 / 0.5 típicamente).
3. **Costes de desarrollo** de cada habilidad primaria y de cada grupo de secundarias
   (`costeHA`, `costeZeon`, `costeAtleticas`, …).
4. **Bonos a habilidades secundarias concretas** (`bonIntimidar`, `bonSigilo`, …).
5. **Arquetipos** (Luchador / Místico / Psíquico / Acechador / Domine).

### 3.4 Puntos de Desarrollo (PDs)

- **600 PDs por nivel** (nivel 1 = 600). Nivel total = nivel + ajuste de nivel de la raza.
- Cada habilidad tiene un **coste** en PDs por punto; el valor comprado es `PDs / coste`.
- El valor final de una habilidad = `base (PDs/coste) + bono de característica + bono de
  categoría + bonos especiales (raza, ventajas, Elan…)`.
- **Límites por categoría**: no se puede invertir más de un % de los PDs en habilidades de
  combate / místicas / psíquicas (`limiteCombate`, etc.).
- Soporta **multiclase** (hasta 5 categorías con cambios de categoría y su coste).

### 3.5 Habilidades

- **Primarias de combate**: H. Ataque, H. Parada, H. Esquiva, Llevar Armadura,
  Conocimiento Marcial, Tablas de Armas, Tablas de Estilo, Artes Marciales, Ars Magnus.
- **Primarias de Ki**: puntos de Ki y acumulación por cada característica (6), técnicas de
  dominio, sellos, pactos, Límites (Agon, Caelum, Cenobus, Cruor, Custodium, Mors,
  Terminus).
- **Primarias místicas**: Zeón, ACT (Acumulación), Múltiplo de regeneración, Proyección
  Mágica, Nivel de Magia, Convocar/Controlar/Atar/Desconvocar.
- **Primarias psíquicas**: CV (Cargas Vitales), Proyección Psíquica, Potencial Psíquico,
  disciplinas y poderes, patrones mentales.
- **Secundarias**, en 7 grupos: Atléticas, Sociales, Perceptivas, Intelectuales, Vigor,
  Subterfugio, Creativas (~45 habilidades, cada una asociada a una característica).

### 3.6 Resistencias

`RF, RE, RV, RM, RP`. Base = **Presencia** + bono de característica asociada + modificador
racial + especiales. Y **Presencia = PD totales ÷ 20** (600/20 = 30 en nivel 1), no un
valor fijo por nivel.

### 3.7 Combate

- **Turno** = base(55) + bono AGI+DES + categoría + armadura + arma + sobrenatural.
- Ataque/Parada/Esquiva son tiradas d100 abiertas enfrentadas.
- **Daño** = base del arma × multiplicador de tamaño + bono FUE + calidad + Ki + Elan.
- **Armadura**: TA por tipo de daño (**FIL, CON, PEN, CAL, ELE, FRI, ENE**), por
  localización, con Entereza, Presencia y Restricción de Movimiento.
- Críticos según tipo de daño; entereza y rotura para daño a objetos.

### 3.8 Otros subsistemas

- **Gnosis** (10/15/…/50): puerta de acceso a Habilidades Esenciales y Poderes de Criatura.
- **Ventajas y Desventajas** (292 entradas): Comunes / Trasfondo / Don / Psíquicas, con
  coste en PCs (1–3, negativo para desventajas).
- **Habilidades Esenciales** (198) y **Poderes de Criatura** (494): compradas con PDs,
  con requisito de Gnosis.
- **Elan** (185 poderes repartidos entre los Señores: Mikael, Gabriel, Rafael, Uriel,
  Barakiel, Azrael, Erebus, Abbadon, Jedah, Noah, Zemial, Eriol, Meseguis, Edamiel…).
- **Sheele**: compañero espiritual vinculado, con ficha propia (características, PV,
  secundarias, mejoras por nivel, tipo elemental).
- **Salud mental** (umbral de locura, cordura) y **Fama** (audacia/cobardía,
  honorabilidad/infamia).
- **Experiencia**: tabla de PX necesarios por nivel, modulada por el ajuste de nivel
  (nivel 1, ajuste 0 → 100 PX; ajuste +1 → 125 PX…). Modo incremental o no.

---

## 4. Datos ya extraídos a JSON

Todo en `data/reglas/`, regenerable con `tools/extraer-tablas.py` (requiere `openpyxl` y
el `.xlsm` original en el mismo directorio que el script, con el nombre `ficha.xlsm`).

| Archivo | Registros | Contenido |
|---|---:|---|
| `razas.json` | 21 | Modificadores raciales completos |
| `categorias.json` | 22 | 83 campos por categoría (costes, límites, bonos) |
| `ventajas.json` | 292 | Ventajas y desventajas con coste y tipo |
| `habilidadesEsenciales.json` | 198 | Con requisito de Gnosis y coste en PDs |
| `poderesCriatura.json` | 494 | Poderes de criatura con Gnosis y coste |
| `armas.json` | 170 | Daño, turno, FUE requerida, críticos, tipo, alcance… |
| `armaduras.json` | 48 | TA por tipo de daño, requerimiento, localización |
| `yelmos.json` | 9 | Ídem para yelmos |
| `artesMarciales.json` | 88 | Daño base, CM, bonos, requisitos |
| `arsMagnus.json` | 57 | Coste en PD y CM, descripción |
| `conjuros.json` | 640 | Vía, nivel, Zeón e intensidad por grado (Base/Int/Avz/Arcano) |
| `poderesPsiquicos.json` | 125 | Disciplina, nivel, efectos por grado de dificultad |
| `disciplinasPsiquicas.json` | 13 | Modificadores de entorno |
| `elan.json` | 185 | Poderes de Elan por patrón |
| `tablasBase.json` | 11 tablas | Bonos, PV, fuerza/peso, gnosis, límites de Ki, cordura, fama, idiomas, nivel de magia, experiencia |

Ficha de ejemplo transcrita: `data/personajes/meirmeister.json` — sirve como **caso de
prueba del modelo de datos** de personaje.

### Lo que NO se ha extraído todavía

- **Técnicas de Ki** (`Tablas Técnicas`, 854 filas): el constructor de técnicas es un
  subsistema entero (ventajas/desventajas de técnica, coste en CM).
- **Mejoras de Sheele** (`Tablas Sheele`, 242 filas).
- **Raíces culturales** (52 entradas, matriz ancha en `Tablas`).
- **Metamagia** (árbol por niveles, está en la hoja `Metamagia`).
- **Legados de sangre**, **Tipologías**, **Municiones**.
- La **lógica VBA**: el código de las macros sigue sin leerse. **Pero las fórmulas de las
  celdas sí se han extraído y verificado** — ver `docs/FORMULAS-VERIFICADAS.md`.

---

## 5. Notas de diseño para la app

Observaciones que conviene recordar al construir:

1. **El cálculo es una cascada de derivaciones.** Nada se guarda "calculado": todo valor
   final es función de (características base + raza + categoría + PDs invertidos +
   ventajas + equipo). Conviene un motor de reglas puro (funciones sin estado) separado de
   la UI, con la ficha guardando sólo las *entradas* del usuario.
2. **Los límites son validaciones, no bloqueos.** La ficha avisa pero deja seguir. La app
   debería hacer lo mismo: marcar en rojo, no impedir (muchas mesas usan reglas caseras —
   de ahí la hoja `Personalización`).
3. **Las fórmulas se leen del propio Excel.** Abriendo el libro con `data_only=False`
   se obtienen las fórmulas en vez de los valores. Es la forma más fiable de verificar el
   motor de reglas, y no necesita el manual. Ver `docs/FORMULAS-VERIFICADAS.md`.
4. **Volumen de datos**: ~2.400 registros de reglas, 1,1 MB de JSON. Hay que cargarlos de
   forma diferida (por ejemplo, los 640 conjuros sólo si el personaje es místico).
5. **Móvil**: la ficha tiene 13 pestañas. En móvil eso debe ser navegación por secciones
   con un resumen siempre visible (PV, Cansancio, Zeón/Ki/CVs, iniciativa).
6. **Uso en mesa**: durante la partida lo que importa es tirar dados, restar PV/Zeón/Ki y
   consultar. La creación de personaje y el juego en mesa son dos modos muy distintos.

---

## 6. Fuentes consultadas

- [Sistema de Anima Beyond Fantasy — Comunidad Umbría](https://www.comunidadumbria.com/partida/el-resurgir-de-los-heroes/sistema-de-anima-beyond-fantasy)
- [Anima Beyond Fantasy: El Sistema de Juego](http://animabf.blogspot.com/2010/11/el-sistema-de-juego.html)
- [Análisis profundo: Anima Beyond Fantasy — Plumarol](http://plumarol.blogspot.com/2014/03/analisis-profundo-anima-beyond-fantasy.html)
- [Anima Project Studio — juego de rol](https://www.animaproject.studio/juego-de-rol/)
