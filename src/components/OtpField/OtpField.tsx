import { TextField, type TextFieldProps } from '../TextField/TextField.tsx'
import styles from './OtpField.module.css'

export interface OtpFieldProps extends Omit<
  TextFieldProps,
  'type' | 'inputMode' | 'autoComplete' | 'label'
> {
  label?: string
  /** También acepta un código de recuperación (`ABCDE-FGHIJ`), con letras. */
  allowRecoveryCode?: boolean
}

/**
 * Un solo campo para el código de verificación: se puede pegar completo y el sistema puede
 * autocompletarlo (`one-time-code`). No impone longitud: el backend tolera espacios y guiones.
 */
export function OtpField({
  allowRecoveryCode = false,
  label = 'Código de verificación',
  inputClassName,
  ...props
}: OtpFieldProps) {
  return (
    <TextField
      {...props}
      label={label}
      type="text"
      inputMode={allowRecoveryCode ? 'text' : 'numeric'}
      autoComplete="one-time-code"
      autoCapitalize={allowRecoveryCode ? 'characters' : 'none'}
      autoCorrect="off"
      spellCheck={false}
      inputClassName={[styles.code, inputClassName].filter(Boolean).join(' ')}
    />
  )
}
