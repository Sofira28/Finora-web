import { Link } from 'react-router'

import styles from '../App.module.css'

export function NotFoundPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.logo}>FINORA</h1>
        <p className={styles.tagline}>No encontramos esta página.</p>
        <p className={styles.tagline}>
          <Link to="/">Ir al inicio</Link>
        </p>
      </div>
    </main>
  )
}
