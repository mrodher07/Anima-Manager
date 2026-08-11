#!/usr/bin/env python3
"""
Genera `supabase/catalogo-oficial.sql`: el catálogo de los manuales en forma de INSERT.

Sale de los mismos JSON que sirve la aplicación, así que no hay dos verdades: se regenera
y se vuelve a ejecutar cada vez que se extrae un manual nuevo.

    python3 tools/sembrar-catalogo.py

El archivo resultante se ejecuta **en el editor SQL de Supabase**, que corre como
administrador. Desde el navegador es imposible: las políticas de `esquema.sql` no dan a
nadie permiso para escribir en un paquete oficial, y eso es justamente lo que impide que
el contenido de los manuales se pueda borrar o cambiar por accidente.

Es idempotente: `on conflict do update` deja cada entrada como está en los JSON, así que
volver a ejecutarlo actualiza lo que haya cambiado y no duplica nada.
"""
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Los mismos paquetes que declara `src/datos/paquetes.ts`, con su carpeta de datos.
PAQUETES = [
    {
        'id': 'core-exxet',
        'nombre': 'Core Exxet',
        'sigla': 'CE',
        'descripcion': 'Manual básico de Anima Beyond Fantasy, edición revisada.',
        'prioridad': 0,
        'carpeta': 'data/reglas',
    },
    {
        'id': 'arcana-exxet',
        'nombre': 'Arcana Exxet',
        'sigla': 'AE',
        'descripcion': 'Secretos de lo sobrenatural: Invocaciones y Encarnaciones.',
        'prioridad': 5,
        'carpeta': 'data/arcana',
    },
    {
        'id': 'los-que-caminaron',
        'nombre': 'Los que Caminaron con Nosotros',
        'sigla': 'LQC',
        'descripcion': 'Compendio de criaturas: bestiario, Razas Perdidas y Sellos por criatura.',
        'prioridad': 10,
        'carpeta': 'data/los-que-caminaron',
    },
]

# Archivos que no son una colección de entradas.
NO_SON_COLECCION = {'index'}


def claves_por_coleccion() -> dict[str, str]:
    """Lee `CLAVE_DE` de tipos.ts en vez de repetirlo aquí: una sola verdad."""
    texto = (RAIZ / 'src/datos/tipos.ts').read_text()
    bloque = texto[texto.index('export const CLAVE_DE'):]
    bloque = bloque[:bloque.index('};')]
    return dict(re.findall(r"(\w+):\s*'([^']+)'", bloque))


def escapar(s: str) -> str:
    return s.replace("'", "''")


def filas_de(carpeta: Path, claves: dict[str, str]):
    """Devuelve (coleccion, clave, datos) por cada entrada de cada JSON de la carpeta."""
    for archivo in sorted(carpeta.glob('*.json')):
        coleccion = archivo.stem
        if coleccion in NO_SON_COLECCION:
            continue
        contenido = json.loads(archivo.read_text())

        # `tablasBase` no es una lista de entradas sino un puñado de tablas sueltas: cada
        # una entra como una fila, con el nombre de la tabla por clave.
        if isinstance(contenido, dict):
            for nombre, tabla in contenido.items():
                yield coleccion, nombre, tabla
            continue

        campo = claves.get(coleccion)
        if not campo:
            print(f'  · {coleccion}: sin clave conocida, se salta')
            continue
        vistos: dict[str, int] = {}
        for entrada in contenido:
            clave = str(entrada.get(campo, '')).strip()
            if not clave:
                continue
            # Algunos manuales repiten un nombre en entradas que son distintas de verdad:
            # hay dos «Inmunidad psicológica» en el Elan, una de Gabriel y otra de Edamiel,
            # y dos «Ola de Poder» en el Sheele, de Agua y de Naturaleza. Como la clave es
            # parte de la primary key, a la segunda y siguientes se les añade un sufijo.
            # No se pierde nada: el nombre de verdad sigue dentro de `datos`.
            vistos[clave] = vistos.get(clave, 0) + 1
            if vistos[clave] > 1:
                clave = f'{clave} #{vistos[clave]}'
            yield coleccion, clave, entrada


def main() -> None:
    claves = claves_por_coleccion()
    lineas = [
        '-- Catálogo de los manuales. GENERADO por tools/sembrar-catalogo.py: no se edita a mano.',
        '--',
        '-- Se ejecuta en el editor SQL de Supabase, que corre como administrador. Desde el',
        '-- navegador es imposible, y a propósito: ningún usuario tiene permiso de escritura',
        '-- sobre un paquete oficial, que es lo que impide que el contenido de los manuales se',
        '-- borre o se cambie por accidente.',
        '--',
        '-- Es idempotente: se puede volver a ejecutar tantas veces como haga falta.',
        '',
        'begin;',
        '',
    ]

    total = 0
    for paquete in PAQUETES:
        carpeta = RAIZ / paquete['carpeta']
        if not carpeta.is_dir():
            print(f'{paquete["id"]}: falta {paquete["carpeta"]}, se salta')
            continue
        print(f'{paquete["id"]}:')

        lineas.append(f'-- ── {paquete["nombre"]} ──')
        lineas.append(
            "insert into public.paquetes (id, nombre, descripcion, sigla, prioridad, oficial)\n"
            f"values ('{paquete['id']}', '{escapar(paquete['nombre'])}', "
            f"'{escapar(paquete['descripcion'])}', '{paquete['sigla']}', {paquete['prioridad']}, true)\n"
            "on conflict (id) do update set\n"
            "  nombre = excluded.nombre, descripcion = excluded.descripcion,\n"
            "  sigla = excluded.sigla, prioridad = excluded.prioridad,\n"
            "  oficial = true, borrado = false, actualizado_en = now();"
        )
        lineas.append('')

        valores = []
        for coleccion, clave, datos in filas_de(carpeta, claves):
            json_datos = escapar(json.dumps(datos, ensure_ascii=False, separators=(',', ':')))
            valores.append(
                f"  ('{paquete['id']}', '{escapar(coleccion)}', "
                f"'{escapar(clave)}', '{json_datos}'::jsonb)"
            )

        print(f'  {len(valores)} entradas')
        total += len(valores)

        # En trozos: un INSERT de 3.000 filas en una sola sentencia es incómodo de leer y
        # de depurar si algo falla.
        TROZO = 200
        for i in range(0, len(valores), TROZO):
            lineas.append('insert into public.catalogo (paquete_id, coleccion, clave, datos) values')
            lineas.append(',\n'.join(valores[i:i + TROZO]))
            lineas.append(
                'on conflict (paquete_id, coleccion, clave) do update set\n'
                '  datos = excluded.datos, borrado = false, actualizado_en = now();'
            )
            lineas.append('')

    lineas.append('commit;')
    lineas.append('')

    salida = RAIZ / 'supabase/catalogo-oficial.sql'
    salida.write_text('\n'.join(lineas))
    tam = salida.stat().st_size / 1024
    print(f'\n{total} entradas → {salida} ({tam:.0f} kB)')


if __name__ == '__main__':
    main()
