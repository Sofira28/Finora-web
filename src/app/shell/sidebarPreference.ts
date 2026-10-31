// Preferencia de barra lateral contraída en escritorio. Es solo comodidad del navegador: si
// el almacenamiento no está disponible (modo privado, bloqueado), se usa la expandida.
const KEY = 'finora.sidebar.collapsed'

export function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(KEY, String(collapsed))
  } catch {
    // Sin almacenamiento la preferencia dura hasta recargar.
  }
}
