import { type ReactNode, useId } from 'react'

import styles from './Profile.module.css'

interface SectionProps {
  title: string
  description?: ReactNode
  children: ReactNode
}

export function Section({ title, description, children }: SectionProps) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={id}>
      <header className={styles.sectionHeader}>
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
        {description && <p className={styles.sectionText}>{description}</p>}
      </header>
      {children}
    </section>
  )
}
