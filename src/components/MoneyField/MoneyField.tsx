import { TextField, type TextFieldProps } from '../TextField/TextField.tsx'
import styles from './MoneyField.module.css'

export type MoneyFieldProps = Omit<TextFieldProps, 'type' | 'inputMode' | 'trailing'>

/**
 * Campo de monto en pesos (FEAT-ACC). Se escribe como en Colombia (`1.250.000` o
 * `1250000,5`); el formulario lo convierte con `parseMoneyInput` a la cadena decimal que
 * espera la API, sin pasar por `number`. Teclado numérico con coma en móviles.
 */
export function MoneyField(props: MoneyFieldProps) {
  return (
    <TextField
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      trailing={
        <span className={styles.currency} aria-hidden="true">
          COP
        </span>
      }
      {...props}
    />
  )
}
