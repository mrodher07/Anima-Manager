# Fórmulas verificadas contra el Excel

Estas fórmulas **no** están deducidas de los rótulos de la hoja: se han leído directamente
de las celdas del `.xlsm` (abriendo el libro sin evaluar, `data_only=False`) y verificadas
numéricamente contra el personaje de ejemplo, *Meirmeister*.

Notación: `Bono_X` = bono de la característica X según `tablasBase.bonoCaracteristica`.

**Contrastado además con el Core Exxet completo** (caps. 1–27, páginas 1–346) y con
**cuatro fichas reales**: Meirmeister (guerrero), Ryo (Ki), Christopher (psíquico, nivel 11)
y Mogunbun (mago con raza propia). Lo marcado con
📖 procede del manual; lo marcado con ✔ se verificó numéricamente contra Meirmeister.

---

## Características

```
totalX  = MIN(20, MAX(0, baseX + modificadorRaza + modificadorVentajas + temporal))
bonoX   = tablaBonoCaracteristica[totalX]
```

Celda `Principal!G11`, `Principal!AS11`, `Principal!AO11`.

> Las razas Nephilim combinan dos filas raciales: si los dos modificadores tienen **el
> mismo signo** se toma el de **mayor valor absoluto**; si tienen signo distinto, se
> **suman**. (`Principal!H58`.)

**Coste en Puntos de Creación**: `tablaBonoCaracteristica[valor].multiplicadorPV`
(3.ª columna) es en realidad el **coste en PCs**, no un multiplicador de PV
(`Principal!AJ27`).

## Puntos de Creación 📖

**PC = 3** al crear el personaje, y se gastan en **ventajas**. Se obtienen más adquiriendo
desventajas. No se usan para comprar características: los "60 pts" de la hoja son un
método alternativo de reparto de características.

## El ajuste de nivel NO da bonos ⚠️

```
nivel                = nivel real del personaje (suma de niveles por categoría)
nivelParaExperiencia = nivel + ajusteNivel racial
```

El **ajuste de nivel** de una raza (Jayán +1, Duk'zarist +3…) **sólo encarece la
experiencia** necesaria para subir. **No** suma para los bonos de categoría.

En la ficha, `Nivel_Total` vale **1** en Meirmeister pese a mostrar «1 + 1», y sus PV son
135 (`120 + 15×1`), no 150. Todo lo que multiplique por nivel usa el nivel **real**.

## Confirmaciones de las otras tres fichas

| Ficha | Confirma |
|---|---|
| **Ryo**, Tecnicista nivel 1 | PV 115 (`20+80+10+5`), cansancio 8, presencia 30, RF 40, RM 45, RP 35, Zeón base 135 por POD 10 |
| **Christopher**, Mentalista **nivel 11** | **1600 PD** (`500 + 100×11`) y presencia **80** (1600÷20). Confirma que los PD no son 600 por nivel |
| **Mogunbun**, Hechicero raza **Moguri** | Características, PV 75 y cansancio 5 con una raza que **no existe en ningún manual** |

Las diferencias que quedan en Mogunbun se explican por ventajas: su RM es 75 y no 65 porque
tiene el **Don** (+10 RM), y su RF es 15 y no 30 por **Debilidad física** (a la mitad).

## Nivel 0

Es un nivel válido. `PDs!T7` devuelve **400 PD** cuando el nivel es 0, lo que da presencia 20.
Un personaje de nivel 0 no recibe los bonos por nivel de su categoría.

## Contenido propio de la mesa

La ficha tiene una hoja entera de **Personalización**: armas, armaduras, ventajas,
habilidades esenciales, poderes de criatura, técnicas de Ki, raíces culturales e idiomas
propios. Y las razas se añaden editando directamente la tabla oculta — así es como esa mesa
metió **Moguri, Bangaa, Viera, Nu Mou, Furia y Seeq**, razas de Final Fantasy Tactics.

En la aplicación, el contenido propio es **un paquete de contenido más**, con prioridad por
encima de los manuales para que pueda además corregirlos. Vive dentro de la campaña y se
exporta con ella.

**Se puede personalizar todo el catálogo**: las 14 colecciones (razas, categorías, ventajas
y desventajas, habilidades esenciales, poderes de criatura, armas, armaduras, yelmos, artes
marciales, Ars Magnus, conjuros, poderes psíquicos, disciplinas psíquicas y Elan).

El editor está **dirigido por esquema**: `src/datos/esquemas.ts` describe los campos de cada
colección y un único componente los pinta todos. Añadir una colección nueva es describirla,
no escribir otro formulario. Una prueba comprueba que **ninguna colección se queda sin
esquema** y que las claves coinciden con las del catálogo.

## Valores por defecto: los de la ficha

Regla del proyecto: **no inventar valores iniciales**. Una ficha nueva arranca como una
hoja en blanco del Excel.

| | Por defecto |
|---|---|
| Raza y categoría | sin elegir |
| Características | **0** (los bonos son 0 por debajo de 1, `Principal!H11`) |
| Nivel | 1, y cuenta aunque no haya categoría (`Nivel_Total = SUM(S7:S16)`) |
| Arma al equipar | **Desarmado**, que es la primera de la tabla del manual |
| Armadura al añadir | sin elegir |
| Enemigo nuevo | todo a **0** |

Con todo a 0 la ficha no se rompe: da PV 20 (`20 + 0 + 0`), cansancio 0, Zeón 0 y ACT 0,
exactamente como la hoja.

## Puntos de Vida

```
PV = 20 + (CON × 10) + Bono_CON + (PV_categoría × nivel)
```

Se usa **la fórmula aritmética de la ficha** (`PDs!U188`), no la Tabla 4 del manual.
Coinciden en todo el rango salvo en **CON 1**, donde la tabla dice 5 y la fórmula 0.

`PDs!Z188 = U188 + V188 + W188 + X188`, donde `U188 = 20 + CON*10 + Bono_Con`.

Verificación Meirmeister: `20 + 9×10 + 10 + 15×1 = 135` ✔ (la ficha muestra 135).
Nótese el `×1`: el ajuste de nivel +1 del Jayán **no** cuenta aquí.

📖 La *Tabla 4: Puntos de Vida Base* del manual coincide con `tablasBase.valoresBase` en
todo el rango salvo en **CON 1**. Se sigue la ficha; la tabla queda disponible como
variable `pvBasePorCON` por si una mesa prefiere usarla.

## Cansancio

```
Cansancio = CON + modificadorCansancioRaza
```

`Principal!AS22 → AQ22 → AO22 = CON + HLOOKUP("Cansancio", Bonos_Raza_Base)`.

Verificación: `9 + 3 (Jayán) = 12` ✔.

> **Corrección importante:** el cansancio **no** sale de la 3.ª columna de la tabla
> `valoresBase`, como supuse en el primer análisis. Sale directamente de CON.

## Regeneración

```
Regeneración = MIN(20, tablaRegen[CON] + modificadorRaza)
```

Con tope de 18 al sumar bonos temporales. `Principal!J11`, `AS19`, `AO19`.

## Tamaño

```
Tamaño = MIN(tope, CON + FUE − (1 si Sexo = Mujer) + modificadorRaza)
```

Tope: 22 normal, 24 para Jayán (y Turak con "Descomunales"), 45 para Criatura.
`Principal!K6`, `AO21`.

Verificación: `9 + 12 − 0 + 5 (Jayán) = 26`, limitado a 24… la ficha muestra 23 porque el
modificador racial efectivo del Jayán ya está aplicado sobre las características base.
**Pendiente de afinar** al implementar.

## Presencia 📖

```
Presencia = PD totales ÷ 20
```

600 PD en nivel 1 → 30. **No** es un valor fijo por nivel: depende de los PD, lo que
importa para criaturas y para PD adicionales.

## Resistencias

```
Resistencia = TRUNC( (Presencia + Bono_CaracterísticaAsociada + modRaza + especiales) × factor )
```

- Presencia = PD ÷ 20 (30 en nivel 1).
- Característica asociada: RF→CON, RE→CON, RV→CON, RM→POD, RP→VOL.
- `factor` = 0.5 si el personaje tiene la desventaja correspondiente.

`Principal!J58`.

Verificación RF: `30 + 10 (Bono_CON) + 20 (Jayán) = 60` ✔.

## Turno / Iniciativa

📖 Turno base **20** para cualquier persona normal. Ejemplo del manual (Celia, guerrero
acróbata): `20 + 10 (Bono_DES) + 15 (Bono_AGI) + 20 (desarmada) + 10 (categoría) = 75`.

```
turnoBase   = 20 + ajustes raciales (Jayán o Turak de tamaño Grande: −10)
                 + ventajas (Reflejos rápidos: +25 / +45 / +60)
turnoNatural = turnoBase + Bono_AGI + Bono_DES + bonoTurnoCategoría + penalizadorNatural
```

`Principal!D24`, `D25`, `D26`, `D27`, `D31`. El penalizador natural viene de la armadura
(`Combate!E16`) más penalizadores por exceso de peso.

**Acciones por turno**: `VLOOKUP(Bono_DES + Bono_AGI, Tabla_NumAcciones)` (`Principal!J32`).

## Habilidades secundarias 📖

```
total = (PD ÷ coste) + Bono_Característica + bonoCategoría
      + habilidadesNaturales + bonificadorNatural
      − 30 si no se ha invertido ningún PD
      + penalizadorNatural (armadura)
```

- **−30 por habilidad sin desarrollar.** Explica los valores negativos de la ficha.
- **Habilidades Naturales**: elegir 5 secundarias distintas y sumar **+10** a cada una.
  Se repite en cada subida de nivel.
- **Bonificador Natural**: repetir el bono de **una característica física** y el de **una
  anímica** sobre dos secundarias ligadas a esos atributos. Sólo si el bono es positivo.

Verificación Trepar (Meirmeister): `0 (sin PD) + 15 (Bono_AGI) − 30 (sin desarrollar)
− 20 (pen. armadura) = −35` ✔ (la ficha muestra −35).

Verificación Acrobacias: `15 (30 PD ÷ coste 2) + 15 (Bono_AGI) + 10 (habilidad natural)
= 40` ✔.

## Límites en el reparto de PD 📖

- Cada categoría limita el gasto en **cada** campo primario (combate / mística / psíquica)
  al **50 % o 60 %** de los PD → **300 o 360 PD** en nivel 1.
- **Las secundarias y las especiales no tienen límite.**
- **Límite adicional que faltaba:** la **Proyección Mágica** y la **Psíquica** no pueden
  llevarse más de **la mitad** del límite del campo correspondiente. Un hechicero (límite
  300) puede gastar como máximo **180 PD** en nivel 1 y **30 PD** por nivel adicional.

## Índices de subida especiales 📖

- **Zeón** sube en **grupos de 5**: con coste 2, cada 2 PD dan **+5 Zeón**.
- **ACT** (Acumulación mágica) y las de **Ki** no son lineales: otorgan capacidades que se
  desarrollan aparte.

---

## Combate — las tres fórmulas que estaban pendientes

### 1. Daño con multiplicador de tamaño ✔ verificada

```
Daño = FLOOR( (dañoArma + dañoMunición) × multiplicadorTamaño , 5 )
     + Bono_FUE × (2 si se empuña a dos manos, 1 si a una)
     + 2 × calidadArma
     + bonos de Ki / Elan / personalización
```

`Combate!AW46`. El multiplicador sale de `tablasBase.armasEnormes`:
Normal ×1, **Enorme ×1.5**, Gigante ×2.

Verificación Meirmeister (Hacha a dos manos, tamaño Enorme, calidad 0, FUE 12 → bono 20):

```
FLOOR(100 × 1.5, 5) = 150
+ 20 × 2 (a dos manos) = 40
────────────────────────────
                      190  ✔  (la ficha muestra 190)
```

### 2. Turno al combinar dos armas ✔ verificada

`Combate!AW40` (turno del arma sola) y `AW41` (turno final):

```
turnoArma = turnoNatural
          + (0 si el arma es tipo Escudo, si no −20)
          + calidad
          + turnoTablaArma
          + (−40 si el Tamaño del personaje < tamaño mínimo del arma enorme)
```

Al combinar con una segunda arma:

- **Si la segunda es un Escudo**: `turnoArma + turnoDelEscudo` (más el ajuste por tamaño).
- **Si es otra arma**: `MIN(turnoArma, turnoDeLaOtra)` y, **si ambas son la misma arma o
  del mismo tipo**, se aplica **−10** si el turno del arma es ≥ 0, o **−20** si es
  negativo.
- Si la mano es "Torpe" y no hay ambidestría, el arma no puede usarse.

### 3. Bonos de artes marciales ✔ verificada

En la Habilidad de Ataque (`Combate!AW42`) y de Parada (`AW43`):

```
HA_arma = HA_final − bonoCategoríaHA
        + MIN( 50 , bonoCategoríaHA + bonoArteMarcialAplicableAlArma )
        + ajusteArmaConocida/Similar/Distinta
        + calidad
        + MIN(0, 10 × (FUE − FUErequerida − penalizadorArmaEnorme))
        + −30 si no es el arma desarrollada y hay "Arma exclusiva"
        + −10/−40 si se usa con la mano torpe
```

**La clave: el bono de categoría más el de artes marciales están topados conjuntamente en
+50.** La Habilidad de Parada añade además el `bonusParada` de la tabla de armas.

La penalización por FUE insuficiente es **−10 por cada punto de FUE que falte**, y usa
`fueReq2M` si el arma se empuña a dos manos.

---

## Corrección aplicada a los datos extraídos

La columna *Atr. Daño* de la tabla de armas **no es un dato del arma**: en la hoja es la
fórmula `=Bono_Fue`, es decir el bono de FUE del personaje cargado. Se había quedado
congelada en `20` (el valor de Meirmeister) para las 170 armas. **Se ha eliminado** de
`data/reglas/armas.json`; el bono de FUE se calcula en tiempo de ejecución.

Se ha añadido `tablasBase.armasEnormes` con los multiplicadores de daño por tamaño de arma.

---

## Qué sigue sin verificar

- Cálculo exacto del **Tamaño** cuando la raza modifica características *y* tamaño
  (posible doble conteo — ver arriba).
- **Zeón, ACT y Nivel de Magia**: se conocen ya el índice de subida y el límite de
  Proyección, pero falta el detalle de ACT y del Nivel de Magia (capítulos de magia, en la
  segunda parte del Core).
- **CVs y Potencial Psíquico** (capítulos de psíquica, segunda parte del Core).
- Coste de **cambio de categoría** en multiclase.
- Cálculo de **técnicas de Ki** (la hoja `Creación de Técnicas`).

Para todo esto sirve el Core Exxet cuando esté disponible, o cargar en la hoja un
personaje místico/psíquico de ejemplo y volver a leer las fórmulas.


---

## Resolución de combate 📖

Lo que necesita el **modo mesa**. Core Exxet, cap. 9.

### Secuencia

```
Resultado del Asalto = (HA atacante + d100 abierto) − (defensa + d100 abierto)
```

**Si el Resultado es positivo → el ataque impacta:**

```
margen = Resultado − Absorción del defensor

si margen < 10   → sin daño (el golpe no penetra)
si margen ≥ 10   → daño% = FLOOR(margen ÷ 10) × 10 %
                   PV perdidos = dañoFinalDelArma × daño%
```

El porcentaje se aplica **al daño final del arma**, no al margen. La *Tabla 42* del manual
es sólo la multiplicación ya calculada; no hace falta implementarla como tabla.

Ejemplos del manual: margen 27 → 20 % de daño; margen 185 → 180 %.

**Si el Resultado es negativo → contraataque.** El defensor recupera la iniciativa y puede
devolver el golpe de inmediato (**Acción Respuesta**), siempre que aún le queden acciones
activas: no vale si ya fue puesto a la defensiva, si gastó sus acciones o si agotó sus
ataques.

**Impactar pone al defensor a la defensiva**: pierde su acción activa de ese turno.

### Absorción

```
Absorción = 20 + (10 × TA correspondiente al tipo de daño)
```

TA 1 → 30 de absorción; TA 6 → 80. El tipo de TA que se usa depende del tipo de ataque
(FIL, CON, PEN, CAL, ELE, FRI, ENE), de ahí que la armadura tenga siete valores.

### Críticos

Un **crítico** se produce cuando **un único impacto hace perder la mitad de los PV
actuales** del objetivo. Es acumulativo: alguien con 180 PV recibe crítico con 90 de daño;
ya en 90 PV, le basta con 45 para el siguiente. Cuanto más dañado está un personaje, más
fácil es criticarlo.

### Cansancio

Cada punto de Cansancio gastado **baja un nivel** el resultado de un dado (uso voluntario
antes de tirar). Con Cansancio 0 el personaje sufre **−120 a la acción**.

---

## Magia 📖 ✔

### La tabla 55 se usa tres veces

`tablasBase.valoresBase` (Tabla 55 del manual) se consulta con **índices distintos**:

| Columna | Índice | Da |
|---|---|---|
| `PV` | CON | Puntos de Vida base |
| `PV` | **POD** | **Zeón base** |
| `ACT` | **POD** | **base de Acumulación (ACT)** |

> **Corrección de datos:** la 3.ª columna estaba etiquetada como `cansancio`. **No lo es**
> — el Cansancio sale de `CON + raza`. Es la base de ACT según POD. Ya renombrada a `ACT`.

### Zeón

```
Zeón base     = valoresBase[POD].PV          (misma tabla que los PV, pero con POD)
Zeón comprado = 5 × TRUNC(PD ÷ coste)
Zeón total    = base + comprado + bonoCategoría×nivel + especiales
```

`PDs!W93`, `PDs!V93`. Verificación Meirmeister (POD 3): `valoresBase[3].PV = 40` ✔
(la ficha muestra Zeón 40).

> ⚠️ **Errata del manual.** El cap. 1 dice que el Zeón sube "en grupos de cinco" (coste 2 →
> 2 PD dan +5). El cap. 11 pone un ejemplo incompatible: "coste 1, gasta 10 PD →
> incrementará su máximo en **100** puntos", cuando con la regla de los grupos de cinco
> serían **50**. **La ficha implementa `5 × TRUNC(PD ÷ coste)`**, es decir la regla del
> cap. 1. Se sigue esa.

### ACT (Acumulación por Turno)

```
ACT base  = valoresBase[POD].ACT
ACT total = ACT base + TRUNC(PD ÷ coste) × ACT base + especiales
```

`PDs!W94`, `PDs!V94`. Cada punto comprado suma otra vez la base según POD, así que el
ACT escala con el Poder del personaje.

Existe además `tablasBase.acumulacionPorPOD` (multiplicador 1–4 según POD), usada en
la acumulación de Ki.

### Nivel de Magia

```
Nivel de Magia = TRUNC(PD ÷ coste) × 5
```

`PDs!V97`.

### Reglas de mesa 📖

- **Regeneración**: se recupera el **ACT final en puntos de Zeón cada día**.
- **Acumular**: se acumula el ACT por asalto. Al terminar un asalto en el que se lanzó
  algún conjuro, **se pierde todo el Zeón acumulado sin gastar, y 10 puntos más**.
- **Conjuro preparado**: se puede sostener tantos asaltos como el valor de **POD**. Si al
  final no se lanza, se pierden **10 puntos de Zeón**.
- **Proyección Mágica** marca también el **alcance máximo** de los conjuros.
- **+40** a la habilidad si se lanza sobre alguien con quien se está en **contacto físico**.
- Recomendación del manual: tener **Zeón ≈ 10 × ACT**.

---

## Psíquica 📖 ✔

Core Exxet, cap. 13.

### Potencial Psíquico

```
Potencial = tablaPotencialPsiquico[VOL] + bonoPorCVgastados + otros
```

`tablasBase.potencialPsiquico` (Tabla 68 del manual) va por **VOL**: 4 o menos → +0,
5 → +10, 6 → +20 … 10 → +60, 15 → +120, 20 → +220.

Verificación Meirmeister (VOL 6): **+20** ✔ (la ficha muestra 20).
Celda `Psíquicos!H11`.

### Uso de un poder

```
d100 abierto + Potencial Psíquico  vs  dificultad del poder
```

Se admiten **tiradas abiertas y pifias**; en una pifia, el nivel de pifia se **resta** del
resultado. El grado de dificultad alcanzado determina qué efecto se consigue: cada poder
tiene una tabla de efectos por dificultad (RUT / FAC / MED / DIF / MDF / ABS / CIM / IMP /
INH / ZEN), que es justo lo que guarda `data/reglas/poderesPsiquicos.json`.

### CV (Cargas Vitales)

Los CV son el recurso del psíquico. Usos:

- **Dominar un poder**: cuesta **1 CV permanente**. Para dominar uno de nivel 2 hay que
  tener antes uno de nivel 1, y así sucesivamente.
- **Mejorar el potencial**: **+20 por CV libre**, máximo **5 CV** (+100), declarado antes
  de tirar.
- **Eliminar la fatiga**: **1 CV** declarado antes de tirar evita perder Cansancio ese
  asalto, sin importar el nivel de fracaso.
- **Adquirir innatos**: mantener un poder de forma pasiva, sin volver a tirar. El innato se
  mantiene a la dificultad **natural** del potencial (sin la tirada ni bonos temporales):
  con +60 se mantiene en Fácil; con +120, en Difícil.

`tablasBase.potencialPorCV` (Tabla 70) da el bono por CV **acumulados**: 1 CV → +10,
3 → +20, 6 → +30, 10 → +40, 15 → +50 … 55 → +100.

### Fatiga psíquica

Al fracasar (cuando el resultado cae en una casilla marcada *Fatiga N*), el personaje
pierde **N CV libres**. Si se queda sin CV libres, pasa a perder **Cansancio**, hasta caer
inconsciente o descansar. **Afecta incluso a seres infatigables.**

### Proyección Psíquica

Equivalente psíquico de la Proyección Mágica: mide el control sobre el poder, no la
puntería. Se usa para atacar y defender. Las disciplinas **Telepatía** y **Sentiente** no
la requieren, pero si no alcanzan ni el 10 %, el objetivo obtiene **+60 a su RP**.

`disciplinasPsiquicas.json` guarda los modificadores de entorno por disciplina
(Piroquinesis, Crioquinesis, Electromagnetismo, contacto físico…).

---

## Experiencia 📖

Cap. 15. El reparto de PX es **discrecional del Director de Juego**, no una fórmula:
se premian las acciones difíciles y relevantes con **1–5 puntos** según la dificultad
para *ese* personaje y la importancia de la escena. Una acción que el personaje supera sin
esfuerzo no da experiencia.

Implicación para la app: la gestión de campaña debe permitir **asignar PX a mano**, no
calcularlos.

---

## Lo que sigue pendiente

Ya no hay nada bloqueado por falta de manual. Queda trabajo de volcado:

- **Técnicas de Ki**: el cap. 10 describe el constructor; falta volcar `Tablas Técnicas`
  (854 filas) a JSON.
- **Mejoras de Sheele** (`Tablas Sheele`, 242 filas) y **raíces culturales** (52).
- **Creación de Seres** (cap. 26) y el **compendio de bestiario** (cap. 27).
- Coste de **cambio de categoría** en multiclase.


---

## Bonos especiales: entrada, no cálculo

La columna «Esp.» de la ficha original **no se deriva de ninguna regla**: son valores que
el jugador escribe a mano con lo que le dan raza, ventajas, Elan o poderes. Intentar
inferirlos del texto de las capacidades raciales sería adivinar.

Se modelan como `bonosEspeciales` del personaje, un campo editable por habilidad. Aplica
tanto a las secundarias como a las primarias de combate (por ejemplo, la ventaja «Uso de
armadura (1)» da +5 por nivel a Llevar Armadura: así se llega a los 50 de la ficha).

## Lo que la aplicación NO debe decidir

Requisito explícito del usuario, y coherente con el manual: en un juego de rol buena parte
de lo que ocurre se interpreta, no se calcula.

- **Experiencia**: el cap. 15 deja el reparto a criterio del Director. Se asigna a mano.
- **Trasfondo y personalidad**: texto libre, sin validación.
- **Notas de sesión**: diario de campaña, escrito por la mesa.
- **Mapas, PNJs y enemigos**: se guardan como imágenes en la galería, sin ficha obligatoria.
- **Todo valor derivado** admite sobrescritura manual conservando el calculado.
- **Los límites avisan**, nunca impiden.

## Efectos de ventajas y desventajas ✔

Los valores **no están inventados**. La ficha codifica cada ventaja como un coeficiente
multiplicado por su casilla de «adquirido», así que se han extraído barriendo las fórmulas
del libro en busca de referencias a `Tablas!G###` dentro del rango de la tabla de ventajas:

| Fórmula de la ficha | Se traduce en |
|---|---|
| `Principal!D24` contiene `25*G315` | Reflejos rápidos (1) = **+25 al turno** |
| `Principal!J58` contiene `G267*25` | Res. física excepcional (1) = **+25 a RF/RE/RV** |
| `PDs!V188` contiene `10*G356` | Difícil de matar (1) = **+10 PV por nivel** |
| `PDs!W28` contiene `5*G368` | Uso de armadura (1) = **+5 a Llevar Armadura por nivel** |
| `PDs!X25` contiene `5*Nivel*G364`, con `MIN(50,…)` | Sentido del combate: Ataque, **tope 50** |
| `Principal!J58` acaba en `*IF(G514>0,0.5,1)` | Debilidad física = **RF a la mitad** |

**109 ventajas** tienen efecto mecánico detectable en la hoja. Están implementadas en
`src/motor/efectos.ts` las que se pueden automatizar sin ambigüedad; el resto llevan una
**nota** que aparece en la ficha como recordatorio (por ejemplo, Endeble: «recibe crítico
con sólo un tercio de sus PV»).

Las que no tienen efecto registrado siguen pudiendo elegirse, y la ficha **avisa** de que
esas hay que aplicarlas a mano.

## Multiclase ✔ ⚠️

### Los PD no son 600 por nivel

```
PD disponibles = 500 + 100 × nivel
```

`PDs!T7` de la ficha: `IF(S7>0, 500 + 100*S7, 400)`. Es decir **600 al crear el personaje
en nivel 1, y +100 por cada nivel** que suba.

> ⚠️ **Corrección.** El motor calculaba `nivel × 600`, que en nivel 2 daba 1200 en vez de
> 700. Encaja con el manual: un hechicero puede gastar 180 PD en Proyección en nivel 1
> (600 × 0,6 ÷ 2) y **30 más por nivel** (700 × 0,6 ÷ 2 = 210).

### Coste de cambiar de categoría

`PDs!Y7`. Se paga en PD y se descuenta de los disponibles:

| Situación | Coste |
|---|---|
| Alguna categoría es **Novel**, o comparten **arquetipo combinado** | **20 PD** |
| Comparten uno de sus **dos arquetipos** (dos «Sin» no cuentan) | **40 PD** |
| No tienen nada en común | **60 PD** |

La ventaja **Versátil** deja el coste **a la mitad**.

Además, `PDs!AI13` exige **al menos 2 niveles** en una categoría antes de volver a cambiar,
salvo con Versátil. Hasta cinco categorías por personaje.

Cada categoría aporta sus bonos **por los niveles hechos en ella**, y la categoría actual
—la última con niveles— es la que manda para costes y límites.

## Los Dominios del Ki

Base en el Core Exxet, capítulo 10; ampliación en **Dominus Exxet**. Todo lo de abajo está
contrastado con las fórmulas de la hoja `Ki` y de `PDs`, y con los ejemplos del manual.

### Puntos de Ki 📖 ✔

`PDs!W30`: `=AGI + IF(AGI-10>0, AGI-10, 0)`. Cada punto hasta 10 da **1** de Ki y cada
punto por encima de 10 da **2**. Sólo cuentan las seis características acumulables: **AGI,
CON, DES, FUE, POD y VOL** (fuera INT y PER).

Verificado con el ejemplo de Celia del Core: 5 + 9 + 10 + 5 + 6 + 4 = **39**. Y con el que
da el propio manual para el doble: DES 13 → **16**.

La **Reserva de Ki** es la suma. Con la ventaja **Poder innato** (Dominus Exxet) pasa a ser
seis veces el Ki del Poder más lo comprado con PD — `Ki!F24` —, y esa ventaja **exige** la
regla opcional de Unificación. Ryo tiene 51 por suma y **60** por Poder innato.

### Acumulación de Ki 📖 ✔

Tabla 53, indexada por el valor de **cualquiera** de las seis características (en el JSON
se llamaba `acumulacionPorPOD` por error; ahora es `acumulacionKi`):

| Característica | Acumulación base |
|---|---|
| 1 a 9 | 1 |
| 10 a 12 | 2 |
| 13 a 15 | 3 |
| 16 o más | 4 |

Una característica a **0 da 0**, no 1: `IF(AGI=0, 0, VLOOKUP(...))`.

`PDs!AA36` da el total: `MAX(0, base + comprada + especial + IF(Mod_ATA<0, MIN(0,
TRUNC(Mod_ATA/20,0)), 0))`. Es decir, **la armadura resta 1 de Acumulación por cada 20
puntos de penalizador**.

Si el personaje hace cualquier otra cosa durante el asalto, la Acumulación se reduce **a la
mitad redondeando hacia arriba** (`CEILING`, `Ki!E12`). La ventaja **Acumulación plena** lo
evita.

### Conocimiento Marcial 📖 ✔

`PDs!AA42` = CM de la categoría **× los niveles hechos en ella** + CM de las artes
marciales dominadas + Maestro marcial (40 / 80 / 120) + lo comprado con PD.

Comprarlo cuesta **5 PD por cada 5 CM**, sea cual sea la categoría, y no se puede meter en
CM más de **una décima parte** de los PD totales. Ese gasto entra además dentro del límite
de habilidades de combate.

Verificado: Christopher (Mentalista, nivel 11) tiene 10 × 11 = **110**; Ryo (Tecnicista,
nivel 1) tiene 50 + 10 de artes marciales = **60**.

### Detección y Ocultación del Ki 📖 ✔

Son habilidades secundarias especiales, y **sólo existen si se ha desarrollado la habilidad
del Ki correspondiente**.

- Detección = `truncar((CM total + Advertir) / 2)` + especiales + 10 × nivel con
  **Percepción del Ki**. Ejemplo de Celia: (120 + 60) / 2 = **90**.
- Ocultación = `truncar((CM total + Ocultarse) / 2)` + especiales + 10 × nivel con
  **Ki imperceptible** + **50 si es D'Anjayni** (30 si Nephilim D'Anjayni).

### Consecuencias de acumular

Dominus Exxet, cap. 1. Si el asalto acaba sin descargar la energía, se pierde Ki:

| Acumulado | Se pierde | Qué pasa |
|---|---|---|
| 20 | 1 | El aura se vuelve visible para todos |
| 40 | 5 | Temblores, piedras flotando, viento fuerte |
| 80 | 10 | Tormentas y rayos; la tierra se agrieta |
| 120+ | la mitad | Lo decide el Director |

Se recuperan **6 puntos por hora** (uno por característica), el doble meditando. La ventaja
**Recuperación de Ki** lo sube a 1 por minuto / 30 s / 6 s según su nivel. Con **10 o menos**
de Ki se pierde 1 de Cansancio cada cinco minutos; con **0**, cada cinco asaltos.

### Límites

Los siete del manual coinciden **exactamente** con los que ya venían del Excel (`Tablas!
C1065:M1071`). Sólo se puede tener uno, salvo con la ventaja **Límite dual**, y hacen falta
**Natura 10 o más**.

### Creación de Técnicas 📖 ✔

Dominus Exxet, cap. 5. Una Técnica es **un** Efecto Primario y los Secundarios que quepan.

| Nivel | CM mínimo | CM máximo | Máx. desventajas |
|---|---|---|---|
| 1 (Básica) | 20 | 50 | 1 |
| 2 (Mayor) | 40 | 100 | 2 |
| 3 (Arcana) | 60 | 200 | 3 |

- El **Primario** siempre cuesta menos Ki que el mismo efecto como Secundario.
- Si los Efectos suman **menos** del mínimo del nivel, la Técnica **cuesta el mínimo**.
- Cada Efecto tiene una característica natural y otras opcionales con **recargo**: usar una
  opcional suma su recargo al coste en Ki del Efecto.
- **Árbol**: para una de nivel 2 hacen falta **dos** de nivel 1; para una Arcana, **dos** de
  nivel 2. La ventaja **Técnicas desvinculadas** se lo salta.
- **Mantenida**: +10 / +20 / +30 CM según el nivel, más el Ki de la columna `Mant.`, que
  hay que volver a pagar cada asalto.
- **Sostenida** (sólo niveles 2 y 3): Menor 5 asaltos, Mayor 20. Cuesta +40/+60 CM en
  nivel 2 y +60/+90 en nivel 3, y **sólo admite Efectos de nivel inferior al suyo**. No se
  mezcla con Mantenida.
- **Alterar el coste**: cada punto de Ki que se rebaje cuesta **10 CM** (máximo 5 puntos,
  nunca por debajo de la mitad del coste base redondeando hacia arriba, y hace falta que la
  Técnica se apoye en **tres características distintas**). Al revés, se descuentan hasta
  **20 CM** a razón de 2 puntos de Ki por cada 5.

Verificado con el ejemplo paso a paso del manual: Habilidad de Ataque +125 (Primario) +
Ataque a Distancia 100 m + Apuntar −100 dan **70 CM**, y al pasar los 18 de Destreza a
Fuerza y Agilidad (+2 cada una) se convierten en 22, quedando **AGI 12, FUE 10, DES 9 y
POD 8**. Y con el de las Sostenidas: +100 al Daño en una Mayor sostenida 5 asaltos = 30 + 40
= **70 CM**.

> ⚠️ **Errata del manual.** El ejemplo de «Mantener las Técnicas» dice que un +50 al Daño
> cuesta *«5 puntos de Ki y 15 de CM»* y saca 7 tras sumar el mantenimiento. Pero la tabla
> de Aumento de Daño del mismo capítulo da **Primario 4**, Secundario 6, CM 15 y Mant. 2.
> Se sigue **la tabla**, que es además lo que implementa la ficha: el coste es 6, no 7. El
> CM sí coincide (15 + 10 = 25).

### Legados de Sangre

Dominus Exxet, cap. 6. Se compran con **Puntos de Creación**, como una ventaja, pero
además dan **+1 al ajuste de nivel** — uno solo, por muchos Legados que se tengan. No suben
los bonos: encarecen la experiencia, igual que el ajuste racial. No se pueden coger al subir
de nivel, ni con la regla opcional de Liberalización de Puntos de Creación.

Son 16, con coste 1 salvo Ojos de la Muerte, Ojos del Destino y Devorador de Existencia,
que valen 2, y Sangre de las Grandes Bestias, que admite 1, 2 o 3 (40, 80 o 120 PD de
Poderes de Criatura como si tuviera Gnosis 5). Cuando el coste es un rango la ficha cobra el
**mínimo** y el resto lo decide el jugador.

> `data/reglas/legadosSangre.json` está **escrito a mano**, no extraído. El capítulo va a
> dos columnas y el texto que sale del PDF las entrelaza: automatizarlo obligaba a inventar
> nombres y costes, que es justo lo que no se debe hacer.

### Sellos de Invocación 📖 ✔

Dominus Exxet, cap. 8. Convocar criaturas con Ki, sin tocar Convocar, Dominación, Atar ni
Desconvocar. Los cinco Sellos salen de los elementos del Samsara de Varja:

| Sello | Elemento | Atrae a |
|---|---|---|
| Aire | Aire | Seres muy veloces, criaturas voladoras, entes etéreos |
| Agua | Agua | Criaturas marinas, seres de gran fuerza, entidades muy hermosas |
| Fuego | Fuego y Luz | Entidades puras, criaturas violentas, seres de comportamiento extremo |
| Metal | Tierra | Lo sólido y lo material, todo lo ajeno al mundo místico |
| Madera | Oscuridad | Seres de la naturaleza, seres espirituales, entidades mágicas |

- **Dominarlos** cuesta **30 CM** el Menor y **60 CM** el Mayor. Para el Mayor de un
  elemento hace falta antes su Menor. *Verificado con el ejemplo de Takanosuke: Madera
  Menor + Madera Mayor + Fuego Menor = **120 CM**.*
- **Ejecutarlos** cuesta **5 puntos de Ki** el Menor y **15** el Mayor.
- Un Sello **Mayor vale por cinco Menores** de su elemento a la hora de llamar a un ser,
  pero sale más barato en Ki: la Asagiri pide 5 Menores de Madera (25 de Ki) o 1 Mayor (15).
- Sin poder gesticular con las manos, las Acumulaciones bajan **a la mitad** redondeando
  hacia arriba. La ventaja **Inutilidad Gestual** lo evita.

**Control de Invocación**: D100 contra **10 por cada nivel** en que la criatura te supere.
Las de nivel igual o inferior vienen solas, salvo Pifia. Los Sellos de refuerzo suman **+5**
(Menor) y **+25** (Mayor). Admite Abiertos y Pifias.

*Verificado con el ejemplo del elemental oscuro: Sombra de nivel 3 contra criatura de nivel
7 → dificultad 40, menos 30 de refuerzo (un Menor y un Mayor) = hay que sacar **10**.*

**Pacto de Sangre** (la invocación inicial): la dificultad sube **30** —como si la criatura
fuese tres niveles más— y el coste en Ki de los Sellos se **dobla**. *Verificado: nivel 2
contra demonio de nivel 6 → 70.*

**Tabla 25, fracaso al invocar:**

| Nivel de fracaso | Consecuencia |
|---|---|
| 0 a −20 | Falla y pierdes el Ki invertido |
| −21 a −50 | Además se rompe el Pacto de Sangre con esa criatura |
| −51 a −100 | Además pierdes el doble de Ki y la mitad de tu Cansancio total |
| −101 o peor | Pierdes la consciencia y todo tu Ki |

> El manual escribe los dos tramos centrales como «Entre -21 y -50» y «Entre -50 y -100»,
> de modo que el **−50 cae en los dos**. Aquí se cierra en −51 para que no haya ambigüedad.

**Mantener** a la criatura cuesta **1 punto de Ki por asalto**, o **2** si es de nivel 10 o
más. Es automático, sin acumular. **Retrasar** una invocación ya preparada cuesta tantos
puntos de Ki como Sellos lleve. Invocar tiene **Turno +20**, el mismo que atacar desarmado.

**Qué se puede invocar**: sólo Seres Entre Mundos y Espíritus. Ni Seres Naturales, ni
construidos (golems, marionetas tecnomágicas), ni no muertos. Las criaturas con **Gnosis 35
o más** son inmunes, salvo que quieran venir o que tu Gnosis sea mayor.

> Si la criatura **acepta** el Pacto no lo decide la aplicación. El manual dice que vale
> cualquier cosa, «desde llegar a un acuerdo con ella hasta forzarla violentamente».

## Arcana Exxet

**Los conjuros y los poderes psíquicos del Arcana ya venían en el Excel.** Las 14 sub-vías
del capítulo 4 (Caos, Guerra, Literae, Muerte, Musical, Nobleza, Paz, Pecado, Conocimiento,
Sangre, Sueños, Tiempo, Umbral y Vacío) están entre los 640 conjuros, y las cinco
disciplinas psíquicas nuevas del capítulo 8 (Causalidad, Electromagnetismo, Teletransporte,
Luz e Hipersensibilidad) entre las trece extraídas.

### Nivel de Magia 📖 ✔

Cuesta **5 PD**, iguales para todas las categorías: la tabla de categorías no trae columna
para él y `PDs!L97:T97` vale 5 en las cinco columnas. Lo comprado es
`truncar(pd / 5) × 5` (`PDs!V97`).

> ⚠️ La ficha suma además un Nivel de Magia **innato** (`PDs!W97`, un `VLOOKUP` sobre
> `Principal!AQ15`) que Mogunbun tiene en 50 y Christopher en 40 sin haber invertido un solo
> PD, más el que da una ventaja por nivel (`PDs!X97`). Eso **todavía no se deriva**: quien lo
> tenga, que sobrescriba el valor a mano, como cualquier otro derivado.

### Metamagia: el Arcana Shepirah 📖 ✔

Arcana Exxet, cap. 3. El árbol tiene **68 esferas**. Cada una lleva dos números, y en el
manual se dibujan distintos:

- El **rojo, encima** de la esfera: el **nivel de personaje** que hace falta. Lo confirma la
  fórmula del rótulo, `=IF(AND($T$12, PDs!$R$17 >= Metamagia!E28), "", "Nv " & E28)`, donde
  `PDs!R17 = SUM(S7:S16)` es el nivel total.
- El **de dentro** de la esfera: lo que cuesta en puntos de **Nivel de Magia**.

El Requerimiento de Nivel **no se salta** aunque sobren puntos de Nivel de Magia.

La misma habilidad aparece en varias posiciones del árbol con requisitos y costes distintos
—«Precisión mística» está en nivel 2 por 5 y en nivel 6 por 10—, así que lo que identifica
una esfera es su **posición**, no su nombre.

> Lo que **no** se ha podido sacar son las **líneas que unen unas esferas con otras**. La
> hoja las dibuja como bordes, no como datos. La regla de empezar en una esfera sin
> requisito y moverse sólo a las conectadas se queda para la mesa; la ficha comprueba el
> nivel y el gasto, que es lo que sí puede verificar.

### Sheele: Espíritus del Alma

Arcana Exxet, cap. 7. Extraídos del Excel: los **ocho tipos** (Aire/Haley, Agua/Corale,
Fuego/Faren, Tierra/Emerald, Luz/Shina, Oscuridad/Xianne, Naturaleza/Quinn, Ilusión/Mesmeria)
con sus características y habilidades de partida, las **95 mejoras** —las de Esotéricas,
Forma de Alma, Magia y Potenciación valen para cualquiera; las demás sólo para su elemento—
y la tabla de **Potenciación Mística** (Controlar 0-400 → Zeón máximo 20-100).

Por ahora son datos consultables y personalizables; falta el editor de Sheele en la ficha.

## Pendiente de modelar
- **Dominus Exxet**: completo.
- **Arcana Exxet**: falta el editor de Sheele en la ficha, las Invocaciones y Encarnaciones
  (caps. 5 y 6), los Teoremas de Magia (cap. 2: Onmyodo, Vodoun, Shamánica y Magia Natural),
  los Rituales y Grimorios (cap. 9) y las reglas opcionales de Nodos y Sanctum Sanctorum
  (cap. 10). Los tres PDF son **escaneos sin capa de texto**, así que lo que no esté en el
  Excel hay que leerlo a ojo página a página.
- **Conjuros y poderes psíquicos seleccionados** como listas del personaje.
- Bestiario y creación de seres.
