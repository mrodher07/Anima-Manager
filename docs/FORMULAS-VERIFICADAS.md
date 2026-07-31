# Fórmulas verificadas contra el Excel

Estas fórmulas **no** están deducidas de los rótulos de la hoja: se han leído directamente
de las celdas del `.xlsm` (abriendo el libro sin evaluar, `data_only=False`) y verificadas
numéricamente contra el personaje de ejemplo, *Meirmeister*.

Notación: `Bono_X` = bono de la característica X según `tablasBase.bonoCaracteristica`.

**Contrastado además con el Core Exxet completo** (caps. 1–27, páginas 1–346). Lo marcado con
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

## Puntos de Vida

```
PV = 20 + (CON × 10) + Bono_CON + (PV_categoría × nivel)
```

`PDs!Z188 = U188 + V188 + W188 + X188`, donde `U188 = 20 + CON*10 + Bono_Con`.

Verificación Meirmeister: `20 + 9×10 + 10 + 15×1 = 135` ✔ (la ficha muestra 135).
Nótese el `×1`: el ajuste de nivel +1 del Jayán **no** cuenta aquí.

📖 La *Tabla 4: Puntos de Vida Base* del manual coincide con `tablasBase.valoresBase`.
**Salvo en CON 1**: la tabla dice 5 y la fórmula daría 0. Usar **la tabla**, no la fórmula.

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

## Pendiente de modelar
- **Ki**: puntos, acumulación, técnicas y Límites.
- **Conjuros y poderes psíquicos seleccionados** como listas del personaje.
- **Multiclase** y coste de cambio de categoría.
- Bestiario y creación de seres.
