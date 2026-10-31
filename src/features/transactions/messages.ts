// Mensajes de la spec §10 (es-CO).
export const TRANSACTION_MESSAGES = {
  amount: 'Escribe un monto mayor que cero, p. ej. 1.250.000.',
  date: 'Elige una fecha entre el 01/01/2000 y hoy.',
  account: 'Elige una de tus cuentas.',
  archived: 'Esta cuenta está archivada. Reactívala para registrar movimientos.',
  destination: 'Elige una cuenta de destino distinta a la de origen.',
  category: 'Elige una categoría.',
  description: 'Escribe una descripción de hasta 80 caracteres.',
  note: 'La nota puede tener hasta 500 caracteres.',
  targetBalance: 'Escribe el saldo real de la cuenta, p. ej. 1.250.000.',
  sameBalance: 'Ese ya es el saldo de la cuenta.',
  notFound: 'No encontramos ese movimiento.',
  transferInfo:
    'Las transferencias entre tus cuentas no se cuentan como gasto ni ingreso. Algunas entidades cobran 4×1000 (GMF); FINORA no lo calcula automáticamente.',
} as const
