import { useEffect, useId, useState } from 'react'

import { Button } from '../../components/index.ts'
import { SearchIcon } from '../../components/icons/index.ts'
import type { Account } from '../accounts/api.ts'
import type { Category, Sort, TransactionType } from './api.ts'
import { CATEGORIES, CATEGORIES_BY_TYPE, isCategoryAllowed } from './categories.ts'
import {
  clearFilters,
  isRestricted,
  SEARCH_MAX,
  SORTS,
  type TransactionFilters as Filters,
} from './filters.ts'
import { type PeriodKey, PERIODS } from './periods.ts'
import { TRANSACTION_TYPES } from './transactionDisplay.ts'
import styles from './Transactions.module.css'

// Espera tras la última tecla antes de buscar.
const SEARCH_DELAY_MS = 300

const TYPE_OPTIONS: readonly (TransactionType | null)[] = [
  null,
  'expense',
  'income',
  'transfer',
  'adjustment',
]

interface TransactionFiltersProps {
  filters: Filters
  accounts: Account[]
  onChange: (next: Filters) => void
}

/** Búsqueda, periodo, categoría, cuenta, orden y tipo (RF-TRX-05). */
export function TransactionFilters({ filters, accounts, onChange }: TransactionFiltersProps) {
  const id = useId()
  const [text, setText] = useState(filters.q)
  const [syncedQ, setSyncedQ] = useState(filters.q)
  // Si la búsqueda cambia desde fuera (Atrás, "Limpiar filtros"), el campo la refleja.
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q)
    setText(filters.q)
  }

  const trimmed = text.trim()
  useEffect(() => {
    if (trimmed === filters.q) return
    const timer = setTimeout(() => {
      onChange({ ...filters, q: trimmed })
    }, SEARCH_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [trimmed, filters, onChange])

  // Enter busca de inmediato, sin esperar.
  const searchNow = () => {
    if (trimmed !== filters.q) onChange({ ...filters, q: trimmed })
  }

  const setType = (type: TransactionType | null) => {
    // Una categoría que no corresponde al nuevo tipo dejaría la lista vacía: se quita.
    const keepCategory =
      filters.category === null ||
      type === null ||
      (type !== 'transfer' && type !== 'adjustment' && isCategoryAllowed(type, filters.category))
    onChange({ ...filters, type, category: keepCategory ? filters.category : null })
  }

  const categoryGroups: { label: string; categories: readonly Category[] }[] =
    filters.type === 'expense' || filters.type === 'income'
      ? [
          {
            label: TRANSACTION_TYPES[filters.type].plural,
            categories: CATEGORIES_BY_TYPE[filters.type],
          },
        ]
      : [
          {
            label: 'Gastos',
            categories: CATEGORIES_BY_TYPE.expense.filter((key) => key !== 'uncategorized'),
          },
          { label: 'Ingresos', categories: CATEGORIES_BY_TYPE.income },
        ]
  const noCategory = filters.type === 'transfer' || filters.type === 'adjustment'

  return (
    <section className={styles.filters} aria-label="Filtros">
      <div className={styles.filterGrid}>
        <form
          role="search"
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault()
            searchNow()
          }}
        >
          <label className={styles.filterLabel} htmlFor={`${id}-q`}>
            Buscar
          </label>
          <div className={styles.searchControl}>
            <SearchIcon className={styles.searchIcon} />
            <input
              id={`${id}-q`}
              type="search"
              className={styles.searchInput}
              value={text}
              maxLength={SEARCH_MAX}
              placeholder="Descripción, nota, categoría o cuenta"
              onChange={(event) => {
                setText(event.target.value)
              }}
            />
          </div>
        </form>
        <SelectField
          id={`${id}-periodo`}
          label="Periodo"
          value={filters.period}
          onChange={(value) => {
            onChange({ ...filters, period: value as PeriodKey })
          }}
        >
          {PERIODS.map((period) => (
            <option key={period.key} value={period.key}>
              {period.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${id}-categoria`}
          label="Categoría"
          value={filters.category ?? ''}
          disabled={noCategory}
          hint={noCategory ? 'Transferencias y ajustes no tienen categoría.' : undefined}
          onChange={(value) => {
            onChange({ ...filters, category: value ? (value as Category) : null })
          }}
        >
          <option value="">Todas las categorías</option>
          {categoryGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.categories.map((key) => (
                <option key={key} value={key}>
                  {CATEGORIES[key].label}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
        <SelectField
          id={`${id}-cuenta`}
          label="Cuenta"
          value={filters.accountId ?? ''}
          onChange={(value) => {
            onChange({ ...filters, accountId: value || null })
          }}
        >
          <option value="">Todas las cuentas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.archived ? `${account.name} (archivada)` : account.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`${id}-orden`}
          label="Ordenar por"
          value={filters.sort}
          onChange={(value) => {
            onChange({ ...filters, sort: value as Sort })
          }}
        >
          {SORTS.map((sort) => (
            <option key={sort.key} value={sort.key}>
              {sort.label}
            </option>
          ))}
        </SelectField>
      </div>
      <div className={styles.filterFooter}>
        <div role="group" aria-label="Tipo de movimiento" className={styles.segmented}>
          {TYPE_OPTIONS.map((type) => (
            <button
              key={type ?? 'all'}
              type="button"
              className={styles.segment}
              aria-pressed={filters.type === type}
              onClick={() => {
                setType(type)
              }}
            >
              {type ? TRANSACTION_TYPES[type].plural : 'Todos'}
            </button>
          ))}
        </div>
        {isRestricted(filters) && (
          <Button
            variant="ghost"
            onClick={() => {
              onChange(clearFilters(filters))
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>
    </section>
  )
}

interface SelectFieldProps {
  id: string
  label: string
  value: string
  hint?: string
  disabled?: boolean
  onChange: (value: string) => void
  children: React.ReactNode
}

function SelectField({ id, label, value, hint, disabled, onChange, children }: SelectFieldProps) {
  return (
    <div className={styles.filterField}>
      <label className={styles.filterLabel} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        disabled={disabled}
        aria-describedby={hint ? `${id}-ayuda` : undefined}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      >
        {children}
      </select>
      {hint && (
        <p id={`${id}-ayuda`} className={styles.filterHint}>
          {hint}
        </p>
      )}
    </div>
  )
}
