// Mensajes de la spec §10 (es-CO).
export const ACCOUNT_MESSAGES = {
  name: 'Escribe un nombre de hasta 60 caracteres.',
  institution: 'Escribe una entidad de hasta 60 caracteres.',
  amount: 'Escribe un monto válido, p. ej. 1.250.000.',
  creditLimit: 'Indica el cupo de la tarjeta.',
  creditLimitPositive: 'El cupo debe ser mayor que cero.',
  day: 'Elige un día entre 1 y 31.',
  hasMovements: 'Esta cuenta ya tiene movimientos. Para corregir el saldo, registra un ajuste.',
  notFound: 'No encontramos esa cuenta.',
} as const
