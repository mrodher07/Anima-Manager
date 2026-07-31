# Anima Manager

Aplicación para llevar el control de partidas del juego de rol
**Anima: Beyond Fantasy** (creación de personajes, fichas y gestión de campañas).

> Estado: **fase de análisis**. Todavía no hay aplicación; lo que hay es el modelo de
> reglas extraído de la ficha comunitaria "Meirmeister" en Excel.

## Contenido

| Ruta | Qué es |
|---|---|
| `docs/ANALISIS-FICHA-EXCEL.md` | Análisis completo de la ficha Excel y del sistema de juego |
| `data/reglas/` | Tablas de reglas en JSON (razas, categorías, ventajas, armas, conjuros…) |
| `data/personajes/meirmeister.json` | Ficha de ejemplo transcrita, como caso de prueba |
| `tools/extraer-tablas.py` | Script que regenera `data/reglas/` desde el `.xlsm` |

## Regenerar los datos

```bash
pip install openpyxl
cp Meirmeister.xlsm tools/ficha.xlsm
python3 tools/extraer-tablas.py
```
