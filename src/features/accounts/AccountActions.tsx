import { type ActionItem, ActionsMenu } from '../../components/index.ts'
import {
  AdjustmentIcon,
  ArchiveIcon,
  EditIcon,
  RestoreIcon,
  TrashIcon,
} from '../../components/icons/index.ts'
import type { Account } from './api.ts'

export interface AccountHandlers {
  edit: (account: Account) => void
  /** Registra un ajuste con el saldo real (FEAT-TRX, RF-TRX-03). */
  adjust: (account: Account) => void
  archive: (account: Account) => void
  restore: (account: Account) => void
  remove: (account: Account) => void
}

/**
 * Acciones de una cuenta: activas (editar, ajustar saldo, archivar, eliminar) o archivadas
 * (reactivar, eliminar). Una archivada no recibe movimientos (RN-TRX-08).
 */
export function AccountActions({
  account,
  handlers,
}: {
  account: Account
  handlers: AccountHandlers
}) {
  const remove: ActionItem = {
    label: 'Eliminar',
    icon: TrashIcon,
    danger: true,
    onSelect: () => {
      handlers.remove(account)
    },
  }
  const items: ActionItem[] = account.archived
    ? [
        {
          label: 'Reactivar',
          icon: RestoreIcon,
          onSelect: () => {
            handlers.restore(account)
          },
        },
        remove,
      ]
    : [
        {
          label: 'Editar',
          icon: EditIcon,
          onSelect: () => {
            handlers.edit(account)
          },
        },
        {
          label: 'Ajustar saldo',
          icon: AdjustmentIcon,
          onSelect: () => {
            handlers.adjust(account)
          },
        },
        {
          label: 'Archivar',
          icon: ArchiveIcon,
          onSelect: () => {
            handlers.archive(account)
          },
        },
        remove,
      ]
  return <ActionsMenu label={`Acciones de ${account.name}`} items={items} />
}
