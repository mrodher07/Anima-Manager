// Prueba del programa de escritorio de verdad: abre la ventana de Tauri y la maneja con
// WebDriver, como lo haría alguien con el ratón. Se lanza con `tools/probar-escritorio.sh`,
// que prepara lo que necesita (pantalla virtual, tauri-driver y una carpeta de datos
// temporal: tus fichas de verdad no se tocan).
//
// Comprueba lo que en el escritorio puede fallar y en la web no: que la página cargue con
// la CSP puesta, el diálogo del sistema para guardar, la copia de seguridad diaria, abrir
// archivos, que lo guardado siga ahí al cerrar y volver a abrir, y que un comando no
// acepte datos con los que escribir fuera de su sitio.
import { Builder, By, Capabilities, until } from 'selenium-webdriver';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = process.env.APP ?? path.join(RAIZ, 'src-tauri/target/debug/anima-manager');
// tools/probar-escritorio.sh pone XDG_DATA_HOME en una carpeta temporal: el programa guarda
// ahí sus datos y sus copias. Sin ella, esta prueba no corre, para no tocar los de verdad.
if (!process.env.XDG_DATA_HOME?.includes('anima-manager-prueba')) {
  console.error('Lánzala con tools/probar-escritorio.sh, que aparta los datos de verdad.');
  process.exit(2);
}
const DATOS = path.join(process.env.XDG_DATA_HOME, 'io.github.mrodher07.animamanager');
const SALIDA = fs.mkdtempSync(path.join(os.tmpdir(), 'anima-manager-salida-'));
const FOTOS = process.env.FOTOS;

const resultados = [];
const ok = (c, m) => {
  resultados.push([c, m]);
  console.log(c ? '  ✓' : '  ✗', m);
};

async function abrir() {
  const caps = new Capabilities();
  caps.setBrowserName('wry');
  caps.set('tauri:options', { application: APP });
  const d = await new Builder().usingServer('http://127.0.0.1:4444/').withCapabilities(caps).build();
  await d.wait(until.elementLocated(By.css('header')), 30000);
  return d;
}
const pulsar = async (d, texto, dentro = '') => {
  await (await d.findElement(By.xpath(`${dentro}//button[normalize-space()='${texto}']`))).click();
  await d.sleep(400);
};
const foto = async (d, nombre) => {
  if (FOTOS) fs.writeFileSync(path.join(FOTOS, `${nombre}.png`), await d.takeScreenshot(), 'base64');
};
/**
 * Escribe en un campo. React a veces vuelve a pintar el formulario justo cuando se le va a
 * escribir (el campo sigue ahí, pero ya es otro): se reintenta un par de veces.
 */
const escribir = async (d, donde, texto) => {
  for (let intento = 1; ; intento++) {
    try {
      const el = await d.findElement(donde);
      await el.clear();
      await el.sendKeys(texto);
      return;
    } catch (e) {
      if (intento >= 4 || !/NotInteractable|StaleElement/.test(e.name)) throw e;
      await d.sleep(500);
    }
  }
};
const elegir = async (sel, valor) =>
  (await sel.findElement(By.xpath(`./option[@value='${valor}' or normalize-space()='${valor}']`))).click();
const xdotool = (...a) => execFileSync('xdotool', a).toString().trim();

let d = await abrir();
try {
  console.log('== Arranque');
  ok((await d.getTitle()) === 'Anima Manager', 'La ventana se llama Anima Manager');
  // Lo que la CSP bloquee y los errores de JavaScript, desde aquí hasta el final.
  await d.executeScript(`window.__problemas = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__problemas.push('CSP: ' + e.violatedDirective + ' ' + e.blockedURI));
    window.addEventListener('error', (e) => window.__problemas.push('JS: ' + e.message));
    window.addEventListener('unhandledrejection', (e) => window.__problemas.push('Promesa: ' + e.reason));`);
  const [hojas, cabecera, puente] = await d.executeScript(
    "return [document.styleSheets.length, getComputedStyle(document.querySelector('header')).backgroundColor, typeof window.__TAURI_INTERNALS__]",
  );
  ok(hojas > 0 && cabecera !== 'rgba(0, 0, 0, 0)', 'Los estilos cargan con la CSP puesta');
  ok(puente === 'object', 'La página ve el puente con Tauri');
  await foto(d, '1-inicio');

  console.log('== Una ficha nueva, con su arma y su munición');
  await pulsar(d, 'Personajes', '//header');
  await pulsar(d, 'Nuevo personaje');
  const editar = await d.findElements(By.xpath("//main//button[normalize-space()='Editar']"));
  if (editar.length) {
    await editar[0].click();
    await d.sleep(400);
  }
  await pulsar(d, 'Identidad', '//main');
  await d.wait(until.elementIsVisible(await d.findElement(By.id('nombre'))), 5000);
  await escribir(d, By.id('nombre'), 'Drak');
  await elegir(await d.findElement(By.id('raza')), 'Turak');
  await elegir(await d.findElement(By.css("select[aria-label='Categoría 1']")), 'Guerrero');
  await pulsar(d, 'Características', '//main');
  for (const [c, v] of Object.entries({ AGI: 8, CON: 11, DES: 8, FUE: 11, INT: 6, PER: 6, POD: 6, VOL: 6 })) {
    await escribir(d, By.id(`car-${c}`), String(v));
  }
  await pulsar(d, 'Equipo', '//main');
  await d.executeScript("document.querySelectorAll('details').forEach((x) => { x.open = true; })");
  await pulsar(d, 'Añadir arma');
  await elegir(await d.findElement(By.css('.campos-arma select')), 'Ballesta');
  await d.sleep(300);
  await elegir((await d.findElements(By.css('.campos-arma select')))[3], 'Saetas');
  await escribir(d, By.xpath("//div[label[normalize-space()='Calidad munición']]/input"), '5');
  await d.sleep(400);
  const linea = await (await d.findElement(By.css('.regla p'))).getText();
  ok(/Daño 60/.test(linea), 'Ballesta con Saetas de calidad +5: daño 60, como la hoja');
  await foto(d, '2-equipo');

  console.log('== Exportar a Excel con el diálogo del sistema');
  await pulsar(d, 'Ficha', '//main');
  const destino = path.join(SALIDA, 'Drak desde el escritorio.xlsx');
  await pulsar(d, 'Exportar a Excel');
  await d.sleep(2500);
  // El diálogo de guardar de GTK, con el foco en el nombre: se escribe la ruta entera.
  const dialogo = xdotool('search', '--name', '^Save File$').split('\n')[0];
  if (dialogo) xdotool('windowfocus', '--sync', dialogo);
  xdotool('key', '--clearmodifiers', 'ctrl+a');
  xdotool('type', '--delay', '20', destino);
  await d.sleep(300);
  xdotool('key', 'Return');
  await d.sleep(2000);
  ok(
    fs.existsSync(destino) && fs.readFileSync(destino).subarray(0, 2).toString() === 'PK',
    'El .xlsx queda donde se ha dicho en el diálogo',
  );

  console.log('== Copias automáticas');
  await pulsar(d, 'Ajustes', '//header');
  await pulsar(d, 'Copia de seguridad', '//main');
  await d.sleep(500);
  const carpeta = await (await d.findElement(By.xpath("//p[contains(., 'Están en')]/code"))).getText();
  ok(carpeta === path.join(DATOS, 'copias'), 'Dice en qué carpeta están las copias');
  await pulsar(d, 'Hacer la de hoy ahora');
  await d.sleep(1500);
  const copias = fs.existsSync(carpeta) ? fs.readdirSync(carpeta) : [];
  const deHoy = copias.find((n) => /^anima-manager-copia-\d{4}-\d{2}-\d{2}\.json$/.test(n));
  ok(!!deHoy, 'La copia de hoy está en la carpeta');
  if (deHoy) ok(fs.readFileSync(path.join(carpeta, deHoy), 'utf8').includes('Drak'), 'Y lleva la ficha nueva');
  await foto(d, '3-copias');

  console.log('== Un comando con datos malos no escribe fuera de su sitio');
  const malo = await d.executeAsyncScript(`
    const listo = arguments[arguments.length - 1];
    window.__TAURI_INTERNALS__.invoke('guardar_copia_automatica', new Uint8Array([1]),
      { headers: { 'x-fecha': '..%2F..%2Fescapada' } })
      .then((r) => listo('aceptado: ' + r), (e) => listo('rechazado: ' + e));`);
  ok(String(malo).startsWith('rechazado'), 'Una «fecha» con ../ se rechaza');

  console.log('== Abrir archivos');
  // En una sesión de WebDriver, WebKit no enseña el selector de archivos (con el ratón sí
  // sale): se le da la ruta al campo, que es lo que manda WebDriver.
  const darArchivo = async (aceptar, ruta) => {
    const campo = await d.findElement(By.css(`input[type=file][accept='${aceptar}']`));
    await d.executeScript("arguments[0].style.display = 'block'", campo);
    await campo.sendKeys(ruta);
    await d.sleep(2500);
  };
  await pulsar(d, 'Galería', '//header');
  await darArchivo('image/*', path.join(RAIZ, 'public/icono-512.png'));
  const imagenes = await d.executeScript(
    "return [...document.querySelectorAll('main img')].map((i) => [i.src.slice(0, 5), i.naturalWidth])",
  );
  ok(imagenes.some(([src, ancho]) => src === 'blob:' && ancho > 0), 'La imagen subida se ve');
  await foto(d, '4-galeria');
  await pulsar(d, 'Personajes', '//header');
  await darArchivo('.xlsx,.xlsm', destino);
  const veces = ((await (await d.findElement(By.css('main'))).getText()).match(/Drak/g) ?? []).length;
  ok(veces >= 2, 'El Excel exportado se vuelve a importar');

  const problemas = await d.executeScript('return window.__problemas');
  ok(problemas.length === 0, `Sin bloqueos de la CSP ni errores de JavaScript${problemas.length ? ': ' + problemas.join(' | ') : ''}`);
} finally {
  await d.quit();
}

console.log('== Al volver a abrir');
fs.rmSync(path.join(DATOS, 'copias'), { recursive: true, force: true });
d = await abrir();
try {
  await d.sleep(7000);
  const solas = fs.existsSync(path.join(DATOS, 'copias')) ? fs.readdirSync(path.join(DATOS, 'copias')) : [];
  ok(solas.length === 1, 'A los pocos segundos de abrir ya hay copia del día, sin pulsar nada');
  await pulsar(d, 'Personajes', '//header');
  ok((await (await d.findElement(By.css('main'))).getText()).includes('Drak'), 'Las fichas siguen ahí');
  await foto(d, '5-reabierto');
} finally {
  await d.quit();
}

fs.rmSync(SALIDA, { recursive: true, force: true });
const fallos = resultados.filter(([c]) => !c);
console.log(`\n${resultados.length - fallos.length}/${resultados.length} bien`);
process.exit(fallos.length ? 1 : 0);
