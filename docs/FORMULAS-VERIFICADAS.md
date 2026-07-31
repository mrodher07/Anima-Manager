# Fórmulas verificadas contra el Excel

Estas fórmulas **no** están deducidas de los rótulos de la hoja: se han leído directamente
de las celdas del `.xlsm` (abriendo el libro sin evaluar, `data_only=False`) y verificadas
numéricamente contra el personaje de ejemplo, *Meirmeister*.

Notación: `Bono_X` = bono de la característica X según `tablasBase.bonoCaracteristica`.

**Contrastado además con el Core Exxet** (primera parte, caps. 1–4). Lo marcado con
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

## Puntos de Vida

```
PV = 20 + (CON × 10) + Bono_CON + (PV_categoría × nivelTotal)
```

`PDs!Z188 = U188 + V188 + W188 + X188`, donde `U188 = 20 + CON*10 + Bono_Con`.

Verificación Meirmeister: `20 + 9×10 + 10 + 15×1 = 135` ✔ (la ficha muestra 135).

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
