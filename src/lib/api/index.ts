export {
  API_BASE,
  ApiError,
  type ApiEventHandlers,
  apiRequest,
  type FieldError,
  type Problem,
  type RequestOptions,
  setApiEventHandlers,
  setCsrfToken,
} from './client.ts'
export type { components } from './schema'

import type { components } from './schema'

/** Atajo para los modelos del OpenAPI del backend (`pnpm api:types`). */
export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name]
