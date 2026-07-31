/**
 * Comprueba el contraste de todos los temas sobre la aplicación ya compilada.
 *
 *   npm run build
 *   npx vite preview --port 4173 &
 *   node tools/contraste.mjs http://127.0.0.1:4173/
 *
 * Se mide contra las variables CSS del tema y no contra `backgroundColor`: al usar
 * degradados, el color de fondo computado es transparente y falsearía la medida.
 *
 * Playwright **no** es dependencia del proyecto: son cientos de megas para una
 * herramienta que sólo se usa al tocar los temas. Instálalo aparte y dile dónde está:
 *
 *   npm i --no-save playwright
 *   PLAYWRIGHT=/ruta/a/node_modules/playwright node tools/contraste.mjs
 *
 * Y `CHROMIUM=/ruta/al/chrome` si el navegador no está donde Playwright lo busca.
 */

const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const EJECUTABLE = process.env.CHROMIUM ?? undefined;

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright').catch(() => {
  console.error(
    'No encuentro Playwright. Instálalo con `npm i --no-save playwright` o indica dónde está\n' +
      'con la variable PLAYWRIGHT (ver la cabecera de este archivo).',
  );
  process.exit(2);
});

/** Mínimos de la WCAG: 4.5 para texto corriente, 3 para secundario y acentos. */
const MINIMOS = { texto: 4.5, tenue: 4.5, debil: 3, oro: 3, oroClaro: 3, sangre: 3, arcano: 3 };

const navegador = await chromium.launch(EJECUTABLE ? { executablePath: EJECUTABLE } : {});
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
await pagina.goto(url, { waitUntil: 'networkidle' });

/**
 * Los temas se descubren leyendo las hojas de estilo, no el menú: así se mide lo que de
 * verdad hay declarado. El tema oscuro es el bloque `:root` sin atributo, y por eso se
 * añade a mano.
 */
const temas = await pagina.evaluate(() => {
  const encontrados = new Set(['oscuro']);
  for (const hoja of document.styleSheets) {
    let reglas;
    try {
      reglas = hoja.cssRules;
    } catch {
      continue; // Hoja de otro origen: no se puede leer.
    }
    for (const regla of reglas) {
      for (const [, id] of String(regla.selectorText ?? '').matchAll(/data-tema=['"]([^'"]+)['"]/g)) {
        encontrados.add(id);
      }
    }
  }
  return [...encontrados];
});

if (temas.length < 2) {
  console.error('Sólo he encontrado el tema por defecto; ¿se ha cargado la hoja de estilos?');
  process.exit(2);
}

let fallos = 0;
for (const nombre of temas) {
  // Es lo mismo que hace `aplicarTema()`, sin depender de cómo esté montado el menú.
  await pagina.evaluate((id) => {
    document.documentElement.dataset.tema = id;
  }, nombre);
  await pagina.waitForTimeout(120);

  const medidas = await pagina.evaluate(() => {
    const raiz = getComputedStyle(document.documentElement);
    const v = (n) => raiz.getPropertyValue(n).trim();
    const aRgb = (c) => {
      const d = document.createElement('div');
      d.style.color = c;
      document.body.appendChild(d);
      const r = getComputedStyle(d).color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      d.remove();
      return r;
    };
    const lum = (c) =>
      aRgb(c)
        .map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; })
        .reduce((t, x, i) => t + [0.2126, 0.7152, 0.0722][i] * x, 0);
    const ratio = (a, bg) => {
      const [l1, l2] = [lum(a), lum(bg)].sort((x, y) => y - x);
      return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2);
    };
    return {
      texto: ratio(v('--texto'), v('--fondo')),
      tenue: ratio(v('--texto-tenue'), v('--panel')),
      debil: ratio(v('--texto-debil'), v('--panel')),
      oro: ratio(v('--oro'), v('--panel')),
      oroClaro: ratio(v('--oro-claro'), v('--panel')),
      sangre: ratio(v('--sangre-claro'), v('--panel')),
      arcano: ratio(v('--arcano-claro'), v('--panel')),
    };
  });

  const linea = Object.entries(medidas).map(([k, valor]) => {
    const ok = valor >= MINIMOS[k];
    if (!ok) fallos++;
    return `${k}=${valor}${ok ? '' : ` ⚠<${MINIMOS[k]}`}`;
  });
  console.log(`${nombre.padEnd(14)} ${linea.join('  ')}`);
}

await navegador.close();
console.log(fallos ? `\n${fallos} valores por debajo del mínimo` : '\nTodos los temas cumplen el contraste mínimo.');
process.exit(fallos ? 1 : 0);
