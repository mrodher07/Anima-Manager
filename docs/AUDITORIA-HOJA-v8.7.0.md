# La hoja v8.7.0 frente a la aplicación

Revisión completa de `Ficha_Anima_v8.7.0.xlsm` (la ficha vacía de la comunidad) contra lo
que calcula y guarda Anima Manager. Hecha el 8 de octubre de 2026.

## Cómo se ha hecho

No se ha comparado «a ojo». La hoja se ha abierto en LibreOffice **sin macros** y se ha
usado como oráculo:

1. `tools/oraculo-hoja.py` rellena en la hoja **29 personajes** de prueba
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
   **Los 29 cuadran en todas** (los 9 últimos, de las opciones de raza).
   Además, `tools/oraculo-hoja.py --armas` empuña en la hoja **871 combinaciones de armas**
   (`data/pruebas/hoja-v870-armas.json`) y `src/motor/hojaV870Armas.test.ts` las compara:
   **cuadran las 871**.
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
| **Combate** | Armadura (capas, calidad, yelmo, penalizadores; escamas y Armadura de energía como capas) | ✔ |
| | Armas: turno, ataque, defensa, daño, entereza, rotura y presencia de las 168, a una y dos manos, con calidad, Enormes y Gigantes | ✔ (871 casos contra la hoja) |
| | Proyectiles con su munición; Armas naturales según la raza; armas del Zodiaco con su Ars Magnus | ✔ |
| | Ars Magnus: coste (Maestro en Armas, Tao, Cáncer) y requisitos en texto; artes marciales: daño y requisitos | ✔ datos; los requisitos se enseñan, no se comprueban |
| | Arma en la mano torpe, «Arma exclusiva», Tablas de armas y de tipología, Tablas de estilo | ✗ |
| **Ki** | Puntos, Acumulación, CM, Detección y Ocultación, Habilidades del Ki y del Némesis, Límites, Técnicas, Sellos | ✔ (puntos y acumulaciones comprobados contra la hoja) |
| | «Mitad» de la Acumulación y Acumulación plena | ◐ como nota |
| **Místicos** | Zeón, ACT, Proyección, Nivel de Magia, Regeneración zeónica, invocación, conjuros, Metamagia, Teoremas | ✔ |
| | Nivel por Vía, conjuros de libre acceso, Ofudas, Conocimiento natural de Vía, Desequilibrio elemental | ✗ (las ventajas, como nota) |
| **Psíquicos** | CV, Proyección, Potencial, disciplinas, poderes | ✔ |
| | Patrones mentales, poderes innatos, concentración, potenciar con CV | ✗ (las ventajas, como nota) |
| **Sheele** | Tipo, mejoras, Potenciación Mística | ✔ (editor propio); las mejoras dicen la regla, no los números de una Sheele concreta |
| **Elan** | Poderes de Elan | ◐ en el catálogo, con la regla en vez del número («[Elan/2]»); no hay Elan por personaje |
| **Creación de Técnicas** | Diseño de Técnicas de Ki | ✔ (creador propio) |
| **Personalización** | Contenido propio, Ventajas en Secundarias | ✔ se importa (ver arriba) |
| | Opciones de raza: Éxtasis sanguíneo (Vetala), Sue'Aman (Ebudan), transformación y fase lunar (Tuan Dalyr), Cercanía con El Dragón (Turak); Duk'zarist según el sexo | ✔ (9 escenarios contra la hoja; se importan) |
| | El atributo de daño de las armas personalizadas | ✔ se importa |
| | Lenguas, raíces, Técnicas, invocaciones, patrones mentales, Legados, Elan personalizados; críticos de las Armas naturales; marionetas de Géminis; familiar demoníaco; nivel sobrenatural de la campaña | ✗ |
| **Resumen** | La hoja para imprimir | ◐ la vista de ficha |

## Diferencias de datos entre versiones de la hoja

**Manda la v8.7.0.** Con ella:

- **Ophiucos Sigma** cuesta **80 PD** (la de Meirmeister decía 60), y la hoja le resta 10 por
  cada Tabla de tipología de armas que se conozca, hasta un mínimo de 10.
- **Atletismo de Meirmeister**: **15**, como da la v8.7.0 con lo que hay anotado (su hoja
  original decía 5). `src/motor/hojaMeirmeister.test.ts` lo comprueba así.
- Los requisitos de los Ars Magnus y de las artes marciales ya no son «NO»/«-» sino el texto
  de la regla (ver `docs/FORMULAS-VERIFICADAS.md`, «Lo que en la hoja depende del
  personaje»).

## Lo que la hoja hace y la aplicación no, a propósito

- **El −10 al turno del Nephilim Turak**: la hoja lo tiene escrito, pero preguntando si la
  *raza* es «Nephilim Turak», y en la hoja un Nephilim es un Humano con la casilla Nephilim
  puesta: no se aplica nunca. Tampoco su crítico FIL natural («Nehpilim» mal escrito). La
  aplicación hace lo mismo que la hoja; si queréis que se aplique, es cambiar una línea.
- **Qué armas conoce cada personaje**: la hoja lo deduce del arma desarrollada y de las
  Tablas de armas y de tipología compradas; la aplicación deja que el jugador lo marque en
  cada arma. Por eso, de las armas del Zodiaco que piden conocer otras (Leo, Taurus,
  Scorpio, Ophiucos), la aplicación avisa en vez de decidir.
- **Un guiño de la hoja**: si el jugador se llama «Xavi», algunos poderes de criatura
  cambian de Gnosis. No se ha copiado.

## Lo que queda

Por impacto en la mesa: especialidades (+40), Tablas de armas y de tipología (darían el
conocimiento de cada arma y el coste de Ophiucos Sigma solos), raíces culturales, lenguas,
Fama y Salud mental, Novel, el nivel por Vía y la mano torpe.
