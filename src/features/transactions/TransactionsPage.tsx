import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Alert, Button, ConfirmDialog, PageHeader } from '../../components/index.ts'
import { PlusIcon } from '../../components/icons/index.ts'
import { useAccounts } from '../accounts/useAccounts.ts'
import { errorMessage } from '../auth/shared/formErrors.ts'
import { ApiError } from '../../lib/api/index.ts'
import { formatDate } from '../../lib/format/index.ts'
import type { Transaction } from './api.ts'
import {
  clearFilters,
  isRestricted,
  parseFilters,
  toApiQuery,
  toSearchParams,
  type TransactionFilters as Filters,
} from './filters.ts'
import { TransactionFilters } from './TransactionFilters.tsx'
import { TransactionFormDialog } from './TransactionFormDialog.tsx'
import { TRANSACTION_MESSAGES } from './messages.ts'
import { TransactionList } from './TransactionList.tsx'
import styles from './Transactions.module.css'
import { TransactionSummary } from './TransactionSummary.tsx'
import { transactionAmount, transactionDescription } from './transactionDisplay.ts'
import { useDeleteTransaction, useTransactions } from './useTransactions.ts'

/** Movimientos (FEAT-TRX): filtros en la URL, resumen, lista y "Cargar más" (RF-TRX-04 a 06, 09). */
type FormState = { mode: 'create' } | { mode: 'edit'; transaction: Transaction } | null
type Notice = { variant: 'success' | 'error'; text: string } | null

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [formState, setFormState] = useState<FormState>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [toDelete, setToDelete] = useState<Transaction | null>(null)
  const remove = useDeleteTransaction()
  const accounts = useAccounts()
  const accountList = useMemo(() => accounts.data?.accounts ?? [], [accounts.data])

  const parsed = parseFilters(searchParams)
  // Una cuenta que no es del usuario (enlace viejo o editado a mano) se ignora.
  const filters: Filters =
    parsed.accountId && accounts.isSuccess && !accountList.some((a) => a.id === parsed.accountId)
      ? { ...parsed, accountId: null }
      : parsed
  // Se recalcula en cada render: al pasar la medianoche de Colombia, "Este mes" cambia de
  // rango y la clave de la consulta también.
  const query = toApiQuery(filters)
  const transactions = useTransactions(query, accounts.isSuccess)

  const setFilters = useCallback(
    (next: Filters) => {
      setSearchParams(toSearchParams(next), { replace: true })
    },
    [setSearchParams],
  )

  const names = useMemo(() => new Map(accountList.map((a) => [a.id, a.name])), [accountList])
  const accountName = useCallback((id: string) => names.get(id) ?? 'Cuenta no disponible', [names])

  const openCreate = () => {
    setNotice(null)
    setFormState({ mode: 'create' })
  }
  const openEdit = (transaction: Transaction) => {
    setNotice(null)
    setFormState({ mode: 'edit', transaction })
  }

  const openDelete = (transaction: Transaction) => {
    setNotice(null)
    remove.reset()
    setToDelete(transaction)
  }
  const confirmDelete = (transaction: Transaction) => {
    remove.mutate(transaction.id, {
      onSuccess: () => {
        setToDelete(null)
        setNotice({ variant: 'success', text: 'Eliminamos el movimiento.' })
      },
      onError: (error) => {
        // Ya no existía (otra pestaña, otro dispositivo): se cierra y la lista se recarga.
        if (error instanceof ApiError && error.status === 404) {
          setToDelete(null)
          setNotice({ variant: 'error', text: TRANSACTION_MESSAGES.notFound })
        }
      },
    })
  }

  const header = (
    <PageHeader
      title="Movimientos"
      description="Historial completo de ingresos, gastos y transferencias."
      actions={
        accounts.isSuccess && (
          <Button onClick={openCreate}>
            <PlusIcon />
            Añadir movimiento
          </Button>
        )
      }
    />
  )

  // Si solo falla "Cargar más", la lista ya cargada se conserva y el error va junto al botón.
  const failed = accounts.isError || (transactions.isError && !transactions.data)
  if (failed) {
    const retry = () => {
      if (accounts.isError) void accounts.refetch()
      else void transactions.refetch()
    }
    return (
      <>
        {header}
        <div className={styles.page}>
          <Alert variant="error" title="No pudimos cargar tus movimientos.">
            {(accounts.error ?? transactions.error)?.message} Tus datos registrados no se han
            modificado.
          </Alert>
          <div>
            <Button
              variant="secondary"
              loading={accounts.isFetching || transactions.isFetching}
              onClick={retry}
            >
              Reintentar
            </Button>
          </div>
        </div>
      </>
    )
  }

  const pages = transactions.data?.pages
  const first = pages?.[0]
  const items = pages?.flatMap((page) => page.items) ?? []
  const hasAnyMovement = accountList.some((account) => account.has_movements)

  return (
    <>
      {header}
      {notice && (
        <div className={styles.notice}>
          <Alert variant={notice.variant}>{notice.text}</Alert>
        </div>
      )}
      <div className={styles.page}>
        <TransactionFilters filters={filters} accounts={accountList} onChange={setFilters} />
        {!first ? (
          <div className={styles.loading} role="status">
            <span className="visually-hidden">Cargando movimientos…</span>
            <div className={styles.skeleton} aria-hidden="true" />
          </div>
        ) : first.total === 0 ? (
          !hasAnyMovement ? (
            <section className={styles.empty} aria-labelledby="sin-movimientos">
              <h2 id="sin-movimientos" className={styles.emptyTitle}>
                Aún no tienes movimientos
              </h2>
              <p className={styles.emptyText}>
                Registra tu primer gasto, ingreso o transferencia para ver aquí tu historial y los
                saldos de tus cuentas al día.
              </p>
            </section>
          ) : (
            <section className={styles.empty} role="status" aria-labelledby="sin-resultados">
              <h2 id="sin-resultados" className={styles.emptyTitle}>
                Sin resultados
              </h2>
              <p className={styles.emptyText}>
                Ningún movimiento coincide con la búsqueda o los filtros seleccionados.
              </p>
              {isRestricted(filters) && (
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilters(clearFilters(filters))
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </section>
          )
        ) : (
          <div
            className={styles.results}
            aria-busy={transactions.isPlaceholderData || undefined}
            data-stale={transactions.isPlaceholderData || undefined}
          >
            <TransactionSummary summary={first.summary} />
            <TransactionList
              transactions={items}
              accountName={accountName}
              sort={filters.sort}
              onSort={(sort) => {
                setFilters({ ...filters, sort })
              }}
              onEdit={openEdit}
              onDelete={openDelete}
            />
            <div className={styles.more}>
              <p className={styles.moreText}>
                Mostrando {items.length.toLocaleString('es-CO')} de{' '}
                {first.total.toLocaleString('es-CO')}
              </p>
              {transactions.hasNextPage && (
                <Button
                  variant="secondary"
                  loading={transactions.isFetchingNextPage}
                  onClick={() => {
                    void transactions.fetchNextPage()
                  }}
                >
                  Cargar más
                </Button>
              )}
              {transactions.isFetchNextPageError && (
                <Alert variant="error">No pudimos cargar más movimientos. Intenta de nuevo.</Alert>
              )}
            </div>
          </div>
        )}
      </div>
      {toDelete && (
        <ConfirmDialog
          open
          title="¿Eliminar este movimiento?"
          description="Se borrará definitivamente y los saldos de tus cuentas se recalcularán. Esta acción no se puede deshacer."
          confirmLabel="Eliminar movimiento"
          variant="danger"
          loading={remove.isPending}
          error={remove.isError ? errorMessage(remove.error) : undefined}
          onConfirm={() => {
            confirmDelete(toDelete)
          }}
          onClose={() => {
            setToDelete(null)
          }}
        >
          <p className={styles.deleteSummary}>
            {[
              transactionDescription(toDelete, accountName),
              formatDate(toDelete.date),
              transactionAmount(toDelete),
            ].join(' · ')}
          </p>
        </ConfirmDialog>
      )}
      {formState && (
        <TransactionFormDialog
          accounts={accountList}
          transaction={formState.mode === 'edit' ? formState.transaction : undefined}
          onClose={() => {
            setFormState(null)
          }}
          onSaved={() => {
            setFormState(null)
            setNotice({
              variant: 'success',
              text:
                formState.mode === 'create'
                  ? 'Registramos el movimiento.'
                  : 'Guardamos los cambios del movimiento.',
            })
          }}
          onNotFound={() => {
            setFormState(null)
            setNotice({ variant: 'error', text: TRANSACTION_MESSAGES.notFound })
          }}
        />
      )}
    </>
  )
}
