# La hoja v8.7.0 frente a la aplicación

Revisión completa de `Ficha_Anima_v8.7.0.xlsm` (la ficha vacía de la comunidad) contra lo
que calcula y guarda Anima Manager. Hecha el 8 de octubre de 2026.

## Cómo se ha hecho

No se ha comparado «a ojo». La hoja se ha abierto en LibreOffice **sin macros** y se ha
usado como oráculo:

1. `tools/oraculo-hoja.py` rellena en la hoja **20 personajes** de prueba
   (`data/pruebas/escenarios.json`) tal y como lo haría un jugador —raza, categoría, nivel,
   características, ventajas y desventajas, PD, Habilidades Naturales, Bonificadores, bonos
   especiales, armadura, yelmo, arma, Cansancio y PV actuales— y guarda lo que la hoja
   calcula en `data/pruebas/hoja-v870.json`.
2. `src/motor/hojaV870.test.ts` rellena los mismos personajes en la aplicación y compara
   **casilla a casilla**: características y bonos, PV, Cansancio, Turno, Presencia, las
   cinco resistencias, Tamaño, Regeneración, Movimiento, Ataque, Parada, Esquiva, Llevar
   Armadura, Conocimiento Marcial, Zeón, ACT, Regeneración zeónica, Proyección mágica,
   Nivel de Magia, las cuatro de invocación, CV, Proyección psíquica, Potencial psíquico, Ki
   y las seis Acumulaciones, penalizador natural, de acción física y requerimiento, los
   siete TA, **las 51 secundarias** y el turno, ataque, defensa y daño del arma.
   **Los 20 cuadran en todas.**
3. Las fórmulas se han leído una a una (`tools/ficha.xlsm`, que no va al repositorio)
   buscando cada ventaja por su casilla de «adquirido», por su nombre y por los nombres
   compuestos («"Apto en campo: "&campo»).
4. El extractor de datos (`tools/extraer-tablas.py`) se ha vuelto a pasar sobre la v8.7.0:
   razas, categorías, ventajas, armas, armaduras, conjuros, poderes… salen **iguales** a lo
   que ya tenía la aplicación (ver «Diferencias de datos» abajo).
5. Para la importación se ha rellenado una hoja con contenido propio en Personalización y
   se ha importado en la aplicación (`data/pruebas/hoja-v870-aldric.json`,
   `src/almacen/hojaComunidadReal.test.ts`).

## Lo que estaba mal y se ha corregido

| Qué | Antes | Ahora (como la hoja) |
|---|---|---|
| Bonos de categoría | Se sumaban una vez | **Por nivel**: el +5 a Ataque del Guerrero son +10 a nivel 2 (`Tablas!E225`) |
| −30 de secundaria sin desarrollar | Sólo con 0 PD | Con **menos de 5 de base** (`PDs!AA129`) |
| Habilidades que piden formación | Daban −30 | Ciencia, Historia, Medicina, Tasación, V. Mágica, Venenos, Baile, Forja y Música: **«—»** |
| Coste de una secundaria | El propio aunque fuera mayor | **El menor** entre el propio y el de su campo (`PDs!AL129`): Frialdad del Guerrero a 2, no a 3 |
| Valoración Mágica | De INT | De **POD** (`PDs!H157`) |
| Bono natural incrementado / Sin bonificador natural | Doblaban / anulaban el **valor** (y la segunda también las Habilidades Naturales) | Doblan / anulan **cuántos** Bonificadores Naturales hay (`PDs!AA185`) |
| Bonificadores Naturales | Uno físico y uno anímico, para siempre | Uno de cada **por nivel**, apilables (`PDs!W`, `U129`) |
| Armadura natural | +2 a FIL, CON, PEN, CAL, sumado sin más | +2 a todo menos ENE, y es **una capa más** (`Combate!AY21`) |
| TA con varias armaduras | El mayor | La mejor, **más la mitad de la segunda** y de la tercera (`Combate!AY9`) |
| Llevar dos armaduras | Sin efecto | **−20** de penalizador natural por cada una de más, hasta −40 (`Combate!S17`) |
| Calidad de la armadura | +1 al TA si era +5 o más | +1 al TA **por cada +5** (a ENE sólo encantada) y rebaja requerimiento, penalizador y restricción |
| Yelmo | Sumaba su TA al cuerpo y su penalizador al natural | Protege **la cabeza** y su penalizador es a la **percepción** (Advertir, Buscar) |
| Nadar y Sigilo con armadura | Como las demás | Nadar sin compensación de Llevar Armadura, Sigilo hasta la mitad (`Principal!O25`, `O58`) |
| No llegar al requerimiento | Sólo restaba a las secundarias físicas… y a la Acumulación de Ki | Resta a las **siete Atléticas y a Ataque, Parada y Esquiva**; **no** a la Acumulación (`PDs!AA25`, `AA36`) |

## Lo que faltaba y se ha añadido

- **Ventajas aplicadas**: Conocimiento de todas las materias, Apto en una materia (1)(2),
  Apto en campo, Aprendizaje innato (1)(2)(3) y de campo, Tamaño no natural, Sentidos
  agudos, Habilidoso, Inmunidad psíquica, Aprendizaje mágico gradual, Recuperación superior
  de magia, Lenta recuperación de magia, Magia estanca. De las 153 ventajas que la hoja
  aplica, la aplicación aplica sola **97** (eran 52) y del resto enseña una nota precisa con
  la casilla de la hoja; la única sin efecto es Apto desarrollo de la magia, que **la propia
  hoja no usa** en ninguna fórmula.
- **A qué habilidad va cada ventaja**: en la pestaña Ventajas, debajo de la lista, como en
  «Ventajas en Secundarias» de la hoja (hasta tres veces cada una, y cada vez se paga).
- Columna **«Bon.»** en las secundarias, para los Bonificadores Naturales.
- **Cargas Vitales**, **Regeneración**, **Movimiento** y **Regeneración zeónica**, con sus
  tablas (`Tabla_Regen`, `Tabla_TipoMovimiento`). El Múltiplo de regeneración se puede
  comprar con PD, a medio coste de ACT.
- **Nivel de Magia innato** por la Inteligencia (`PDs!W97`).
- **Cansancio y Endeble a toda acción** (`Mod_ATA`): con 4 o menos de Cansancio actual,
  −10/−20/−40/−80 y −120 a cero, que Exhausto dobla e Inmunidad al dolor reduce; restan a
  combate, secundarias, proyecciones, potencial, invocación, y la mitad a Turno y ACT.
- Las **cinco secundarias** que la hoja tiene y la aplicación no: Ley, Caligrafía ritual,
  Orfebrería, Confección y Confección de marionetas.
- Los bonos **«Esp.»** de Zeón, ACT, Nivel de Magia y CV, que la hoja tiene.

## La importación de la hoja de la comunidad

Antes se perdía todo lo de la pestaña **Personalización** y las columnas que el jugador
marca a mano. Ahora se trae:

- **Contenido propio de la mesa**: ventajas, desventajas, armas, armaduras (y yelmos), Ars
  Magnus, Habilidades Esenciales y poderes de criatura. Se leen de la pestaña oculta
  «Tablas», donde la hoja ya los coloca con la misma forma que los del manual, y van al
  **Contenido propio** de la campaña activa si eres su máster. Si la campaña es de otro,
  se avisa de que se lo pases.
- **Ventajas en Secundarias**: a qué habilidad va cada Apto en una materia y Aprendizaje
  innato.
- Columnas **Hab., Bon. y Esp.** de la pestaña PDs.

Además se han quitado del catálogo los **huecos** que la hoja tiene para eso («Ventaja
personalizada #1», «Desventaja Personalizada #1» —que encima salía como ventaja—, «Armadura
#1», «Poder #1», «Habilidad #1», «Ars Magnus Personalizado 1», «Elan Personalizado»): no son
contenido, son casillas vacías.

## Pestaña a pestaña

✔ hecho y comprobado contra la hoja · ◐ hecho en parte · ✗ falta

| Pestaña | Qué tiene | Estado |
|---|---|---|
| **General** | Nombre, raza, sexo, apariencia, historia, personalidad, contactos, dinero, experiencia, peso | ✔ |
| | Nephilim y etnia, región y clase social | ◐ se guardan como texto; no dan bonos |
| | Fama, Audacia, Cobardía, Honorabilidad, Infamia; Salud mental y umbral de locura | ✗ |
| | Experiencia incremental, Artefactos | ✗ (Curtido y Fama, como nota) |
| **Principal** | Características, PV, Cansancio, Regeneración, Movimiento, Tamaño, Turno, resistencias, Presencia | ✔ |
| | Ventajas y desventajas, Puntos de Creación, Legados, Habilidades Esenciales | ✔ |
| | Poderes de criatura, Gnosis, tipo de criatura | ◐ en el bestiario; no en la ficha de personaje |
| | Lenguas | ✗ (la tabla de idiomas ya está en los datos) |
| | Puntos de Destino | ◐ se cuentan los usados en partida |
| **PDs** | PD por habilidad, costes, límites, Bonos de categoría por nivel, Naturales, Bonificadores, Esp. | ✔ |
| | Especialidad de una secundaria (+40) | ✗ |
| | Bonos de Novel (+10 a habilidades elegidas) | ✗ |
| | Raíces culturales (bonos por región y clase social) | ✗ |
| | Varias categorías con su coste cada una | ◐ el multiclase existe; el coste es el de la categoría actual |
| **Combate** | Armadura (capas, calidad, yelmo, penalizadores) y arma equipada | ✔ |
| | Ars Magnus y artes marciales | ◐ están; no comprobados contra la hoja |
| | Arma en la mano torpe, proyectiles y munición, Tablas de estilo | ✗ no comprobado contra la hoja |
| **Ki** | Puntos, Acumulación, CM, Detección y Ocultación, Habilidades del Ki y del Némesis, Límites, Técnicas, Sellos | ✔ (puntos y acumulaciones comprobados contra la hoja) |
| | «Mitad» de la Acumulación y Acumulación plena | ◐ como nota |
| **Místicos** | Zeón, ACT, Proyección, Nivel de Magia, Regeneración zeónica, invocación, conjuros, Metamagia, Teoremas | ✔ |
| | Nivel por Vía, conjuros de libre acceso, Ofudas, Conocimiento natural de Vía, Desequilibrio elemental | ✗ (las ventajas, como nota) |
| **Psíquicos** | CV, Proyección, Potencial, disciplinas, poderes | ✔ |
| | Patrones mentales, poderes innatos, concentración, potenciar con CV | ✗ (las ventajas, como nota) |
| **Sheele** | Tipo, mejoras, Potenciación Mística | ✔ (editor propio; no comprobado contra la hoja) |
| **Elan** | Poderes de Elan | ◐ en el catálogo; no hay Elan por personaje |
| **Creación de Técnicas** | Diseño de Técnicas de Ki | ✔ (creador propio) |
| **Personalización** | Contenido propio, Ventajas en Secundarias | ✔ se importa (ver arriba) |
| | Lenguas, raíces, Técnicas, invocaciones, patrones mentales, Legados, Elan personalizados; opciones de raza (Turak, Vetala, Ebudan, Tuan Dalyr); marionetas de Géminis; familiar demoníaco; nivel sobrenatural de la campaña | ✗ |
| **Resumen** | La hoja para imprimir | ◐ la vista de ficha |

## Diferencias de datos entre versiones de la hoja

Al volver a extraer los datos de la v8.7.0, todo coincide con los de la hoja de Meirmeister
salvo dos entradas de Ars Magnus:

- **Ophiucos Sigma**: 60 PD en la hoja de Meirmeister, **80** en la v8.7.0.
- **Guardián**: cambia su casilla de requisitos.

No se han tocado: hay que decidir cuál vale.

## Lo que queda por decidir

1. **Ophiucos Sigma**: ¿60 u 80 PD?
2. **Atletismo de Meirmeister**: su hoja original dice 5 y con los datos transcritos salen
   15, también en la v8.7.0. La diferencia son justo los 10 de una Habilidad Natural.
3. Qué de la lista ✗ se hace primero. Por impacto en la mesa, la propuesta es:
   especialidades (+40), raíces culturales, lenguas, Fama y Salud mental, Novel, y el
   nivel por Vía.
