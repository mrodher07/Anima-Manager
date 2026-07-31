# Anima Manager

Aplicación para llevar el control de partidas del juego de rol
**Anima: Beyond Fantasy**: creación de personajes, fichas y gestión de campañas.

Funciona igual en ordenador y en móvil, con tema oscuro y claro.

## Empezar

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # 65 pruebas del motor de reglas
npm run build    # compilar para producción
```

## Qué hace

| Sección | Para qué |
|---|---|
| **Personajes** | Lista de fichas, crear, exportar e importar JSON |
| **Ficha** | Vista de consulta con recursos, características, resistencias, combate y secundarias |
| **Editar** | Identidad, características, ventajas, habilidades, equipo y poderes |
| **Mesa** | Jugar: gastar recursos, tirar iniciativa, resolver ataques, tiradas rápidas |
| **Galería** | Mapas, PNJs, enemigos y objetos en imágenes |
| **Campañas** | Reglas caseras, manuales activos y diario de sesiones |
| **Reglas** | Reescribir o desactivar cualquier fórmula, y restablecerla |

## Cómo está montado

```
data/reglas/     Catálogo en JSON extraído del Core Exxet (~2.400 registros)
docs/            Análisis de la ficha original y fórmulas verificadas
src/motor/       Motor de reglas. Funciones puras, sin interfaz
  expresiones.ts   Evaluador acotado para las fórmulas (sin eval)
  reglamento.ts    Catálogo de reglas configurable por mesa
  personaje.ts     Modelo de ficha y derivación de valores
  combate.ts       Armadura, armas y resolución de asaltos
  dados.ts         d100 con tiradas abiertas y pifias
src/datos/       Paquetes de contenido combinables (un manual = un paquete)
src/almacen/     Persistencia en IndexedDB, exportar e importar
src/ui/          Interfaz React
tools/           Script que regenera data/reglas desde el .xlsm original
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

## Imágenes

Se guardan en su propio almacén de IndexedDB, no dentro de la ficha, así que un personaje
sigue pesando unos kilobytes. Al subirlas se **reescalan y se convierten a WebP** (1600 px
de lado para mapas, 640 para retratos): una foto de móvil de 5 MB llenaría la cuota del
navegador en pocas subidas.

Al exportar una ficha, **su retrato viaja con ella** como data URI, para que llegue
completa a quien la reciba. Si el navegador se queda sin espacio, la aplicación lo dice en
lugar de fallar en silencio.

## Qué falta

Está anotado al final de `docs/FORMULAS-VERIFICADAS.md`. En resumen: las ventajas se
eligen y cuentan Puntos de Creación, pero todavía no aplican solas su efecto mecánico
(mientras tanto se compensan con el campo «Esp.»); faltan Ki, multiclase y bestiario.

## Regenerar el catálogo

```bash
pip install openpyxl
cp Meirmeister.xlsm tools/ficha.xlsm
python3 tools/extraer-tablas.py
```
