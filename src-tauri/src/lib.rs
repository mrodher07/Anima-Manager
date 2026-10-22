//! Anima Manager de escritorio.
//!
//! La ventana carga la misma aplicación que la web (la carpeta `dist` que genera Vite), con
//! sus datos en la propia ventana, como en el navegador. Lo único que añade el escritorio es
//! lo que el navegador no deja hacer bien:
//!
//! - guardar un archivo (la ficha en Excel, una exportación, una copia) donde el usuario
//!   elija, con el diálogo del sistema;
//! - dejar cada día una copia de seguridad en la carpeta de datos del programa, por si algo
//!   se borra, y abrir esa carpeta.
//!
//! Nada más. La página no recibe acceso a archivos ni a diálogos (ver
//! `capabilities/default.json`): sólo puede llamar a estos comandos, y cada uno hace una cosa
//! concreta. Fuera de la carpeta de copias sólo se escribe donde el usuario diga en el
//! diálogo, y el nombre de las copias lo pone este código, no la página.

use std::fs;
use std::path::{Path, PathBuf};

use percent_encoding::percent_decode_str;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// Cuántas copias automáticas se guardan: dos semanas, una por día.
const COPIAS_QUE_SE_GUARDAN: usize = 14;
const PREFIJO_COPIA: &str = "anima-manager-copia-";

/// Los bytes del archivo van en crudo, sin pasar por JSON: una copia con la galería pesa.
fn cuerpo<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(datos) => Ok(datos),
        InvokeBody::Json(_) => Err("Se esperaban los bytes del archivo.".into()),
    }
}

/// El resto va en una cabecera, codificado con `encodeURIComponent` para que quepan tildes.
fn cabecera(request: &Request<'_>, nombre: &str) -> Result<String, String> {
    let valor = request
        .headers()
        .get(nombre)
        .ok_or_else(|| format!("Falta «{nombre}»."))?
        .to_str()
        .map_err(|e| e.to_string())?;
    percent_decode_str(valor)
        .decode_utf8()
        .map(|s| s.into_owned())
        .map_err(|e| e.to_string())
}

/// Guarda un archivo donde elija el usuario. Devuelve la ruta, o nada si cancela.
#[tauri::command]
async fn guardar_archivo(app: AppHandle, request: Request<'_>) -> Result<Option<String>, String> {
    let nombre = cabecera(&request, "x-nombre")?;
    let datos = cuerpo(&request)?;
    let mut dialogo = app.dialog().file().set_file_name(&nombre);
    if let Some(ext) = Path::new(&nombre).extension().and_then(|e| e.to_str()) {
        dialogo = dialogo.add_filter(ext.to_uppercase(), &[ext]);
    }
    // Bloquea este hilo, no la ventana: los comandos `async` no corren en el principal.
    let Some(ruta) = dialogo.blocking_save_file() else {
        return Ok(None);
    };
    let ruta = ruta.into_path().map_err(|e| e.to_string())?;
    fs::write(&ruta, datos)
        .map_err(|e| format!("No he podido escribir {}: {e}", ruta.display()))?;
    Ok(Some(ruta.display().to_string()))
}

fn carpeta_de_copias(app: &AppHandle) -> Result<PathBuf, String> {
    let carpeta = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("copias");
    fs::create_dir_all(&carpeta).map_err(|e| e.to_string())?;
    Ok(carpeta)
}

/// `AAAA-MM-DD` y nada más: es lo único de la página que acaba en un nombre de archivo.
fn es_fecha(texto: &str) -> bool {
    texto.len() == 10
        && texto.char_indices().all(|(i, c)| {
            if i == 4 || i == 7 {
                c == '-'
            } else {
                c.is_ascii_digit()
            }
        })
}

fn es_copia(ruta: &Path) -> bool {
    ruta.file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| n.starts_with(PREFIJO_COPIA) && n.ends_with(".json"))
}

/// La copia de seguridad del día, en la carpeta de datos del programa. Una por día (la del
/// día se va pisando) y sólo las más recientes.
#[tauri::command]
async fn guardar_copia_automatica(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let fecha = cabecera(&request, "x-fecha")?;
    if !es_fecha(&fecha) {
        return Err(format!("Fecha no válida: «{fecha}»."));
    }
    let datos = cuerpo(&request)?;
    let carpeta = carpeta_de_copias(&app)?;
    let ruta = carpeta.join(format!("{PREFIJO_COPIA}{fecha}.json"));
    // Primero a un temporal y luego se renombra: si el programa se cierra a medias, la copia
    // buena del día sigue entera.
    let temporal = carpeta.join(format!("{PREFIJO_COPIA}{fecha}.json.tmp"));
    fs::write(&temporal, datos).map_err(|e| e.to_string())?;
    fs::rename(&temporal, &ruta).map_err(|e| e.to_string())?;

    let mut copias: Vec<PathBuf> = fs::read_dir(&carpeta)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| es_copia(p))
        .collect();
    // La fecha va en el nombre, así que el orden alfabético es el de los días.
    copias.sort();
    let sobran = copias.len().saturating_sub(COPIAS_QUE_SE_GUARDAN);
    for vieja in &copias[..sobran] {
        let _ = fs::remove_file(vieja);
    }
    Ok(ruta.display().to_string())
}

/// Dónde están las copias automáticas, para decírselo al usuario.
#[tauri::command]
fn carpeta_copias(app: AppHandle) -> Result<String, String> {
    carpeta_de_copias(&app).map(|c| c.display().to_string())
}

/// Abre la carpeta de las copias en el explorador de archivos del sistema.
#[tauri::command]
fn abrir_carpeta_copias(app: AppHandle) -> Result<(), String> {
    let carpeta = carpeta_de_copias(&app)?;
    app.opener()
        .open_path(carpeta.display().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            guardar_archivo,
            guardar_copia_automatica,
            carpeta_copias,
            abrir_carpeta_copias,
        ])
        .run(tauri::generate_context!())
        .expect("no se ha podido arrancar Anima Manager");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn solo_acepta_fechas() {
        assert!(es_fecha("2026-10-22"));
        assert!(!es_fecha("2026-10-2"));
        assert!(!es_fecha("../../etc/x"));
        assert!(!es_fecha("2026/10/22"));
        assert!(!es_fecha("2026-10-22x"));
    }

    #[test]
    fn reconoce_sus_copias() {
        assert!(es_copia(Path::new("/x/anima-manager-copia-2026-10-22.json")));
        assert!(!es_copia(Path::new("/x/anima-manager-copia-2026-10-22.json.tmp")));
        assert!(!es_copia(Path::new("/x/otra-cosa.json")));
    }
}
