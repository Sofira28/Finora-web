import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom no implementa los diálogos modales: lo mínimo para que `<dialog>` abra, cierre y
// responda a Esc como en el navegador.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
    this.setAttribute('aria-modal', 'true')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.removeAttribute('aria-modal')
    this.dispatchEvent(new Event('close'))
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    const dialog = document.querySelector('dialog[open]')
    dialog?.dispatchEvent(new Event('cancel', { cancelable: true }))
  })
}
