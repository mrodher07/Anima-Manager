// En Windows, sin esto se abriría una consola negra detrás de la ventana. No quitar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    anima_manager_lib::run();
}
