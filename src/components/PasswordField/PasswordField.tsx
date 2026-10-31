import { useState } from 'react'

import { EyeIcon, EyeOffIcon } from '../icons/index.ts'
import { TextField, type TextFieldProps } from '../TextField/TextField.tsx'
import styles from './PasswordField.module.css'

export interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'trailing'> {
  /** `current-password` para entrar; `new-password` para crear o cambiar (gestores de claves). */
  autoComplete: 'current-password' | 'new-password'
}

/**
 * Contraseña con botón para mostrarla u ocultarla. Se puede pegar y usar gestores de
 * contraseñas (WCAG 2.2, 3.3.8; RNF-AUTH-07): no se bloquea ningún evento del portapapeles.
 */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      trailing={
        <button
          type="button"
          className={styles.toggle}
          aria-label="Mostrar contraseña"
          aria-pressed={visible}
          onClick={() => {
            setVisible((value) => !value)
          }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  )
}
