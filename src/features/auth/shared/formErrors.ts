import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from '../../../lib/api/index.ts'

/**
 * Lleva los errores por campo de un `422` del backend al formulario. `fallbacks` da el texto
 * para los errores de formato, que el backend no acompaña de mensaje. Devuelve si aplicó alguno.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fallbacks: Partial<Record<Path<T>, string>>,
): boolean {
  if (!(error instanceof ApiError) || error.status !== 422) return false
  let applied = false
  for (const fieldError of error.problem.errors ?? []) {
    const field = fieldError.loc.at(-1)
    if (typeof field !== 'string' || !(field in fallbacks)) continue
    const name = field as Path<T>
    const message = fieldError.message ?? fallbacks[name]
    if (!message) continue
    setError(name, { type: 'server', message }, { shouldFocus: !applied })
    applied = true
  }
  return applied
}

/** Mensaje para mostrar de un error cualquiera (los del backend ya vienen en es-CO). */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'
}
