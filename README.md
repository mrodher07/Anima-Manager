# Anima Manager

Aplicación para llevar el control de partidas del juego de rol
**Anima: Beyond Fantasy**: creación de personajes, fichas y gestión de campañas.

> Estado: **esqueleto funcional**. El motor de reglas está completo y verificado; la
> interfaz tiene la ficha de personaje y el editor de reglas caseras.

## Empezar

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # 42 pruebas del motor de reglas
npm run build    # compilar para producción
```

## Cómo está montado

```
data/reglas/     Catálogo en JSON extraído del Core Exxet (~2.400 registros)
docs/            Análisis de la ficha original y fórmulas verificadas
src/motor/       Motor de reglas. Funciones puras, sin interfaz
  expresiones.ts   Evaluador acotado para las fórmulas (sin eval)
  reglamento.ts    Catálogo de reglas configurable por mesa
  personaje.ts     Modelo de ficha y derivación de valores
src/datos/       Paquetes de contenido combinables (un manual = un paquete)
src/almacen/     Persistencia en IndexedDB, exportar e importar
src/ui/          Interfaz React, responsive, tema claro y oscuro
tools/           Script que regenera data/reglas desde el .xlsm original
```

### Tres decisiones que conviene conocer

**El motor no sabe nada de la interfaz.** Todo el cálculo son funciones puras: mismos
datos, mismo resultado. Eso es lo que permite verificarlo contra la ficha original.

**Las reglas son datos, no código.** Cada regla vive en `reglamento.ts` con su fórmula,
su referencia al manual y sus variables documentadas. Una mesa puede reescribir cualquier
fórmula o desactivar las opcionales, y volver a los valores por defecto cuando quiera.
Se guarda **sólo lo que cambia**, así que las correcciones futuras del reglamento oficial
llegan solas a quien no lo haya tocado.

Las fórmulas se evalúan con un intérprete propio y acotado — **nunca con `eval`**. Cuando
llegue la sincronización, una fórmula escrita por un jugador se ejecutaría en el navegador
del máster al abrir su ficha.

**Un manual es un paquete de contenido.** El Core Exxet es sólo el primero. Al añadir un
suplemento basta con registrar su paquete y sus JSON: sus entradas se combinan con las del
básico y pueden corregirlas, y cada entrada recuerda de qué manual viene.

## Regenerar el catálogo

```bash
pip install openpyxl
cp Meirmeister.xlsm tools/ficha.xlsm
python3 tools/extraer-tablas.py
```
