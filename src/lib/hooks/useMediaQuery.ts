import { useSyncExternalStore } from 'react'

/** Si la consulta de medios se cumple; se actualiza al cambiar el tamaño de la ventana. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => {
        list.removeEventListener('change', onChange)
      }
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
}
