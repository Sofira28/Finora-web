# finora-web

Aplicación frontend de FINORA.

## Responsabilidad

- Interfaz de usuario en español colombiano (`es-CO`), con montos en COP y fechas en DD/MM/AAAA.
- Implementación fiel del diseño aprobado en Claude Design (ver `../docs/guides/claude-design.md`).
- Accesibilidad WCAG 2.2 AA y comportamiento responsive (escritorio, tablet y móvil).
- Consumo de la API según `../specs/api-contracts.md`. La validación en el cliente es solo una ayuda al usuario.

## Estado

**Stack:** TypeScript + React + Vite ([ADR-0001](../docs/decisions/ADR-0001-stack-tecnologico.md)). Estructura base creada en `project-setup`; aún sin pantallas. Esta aplicación es independiente de `finora-back`.

## Requisitos

- Node.js 22 o superior
- pnpm (`npm install -g pnpm`)

## Comandos

```bash
pnpm install       # instalar dependencias
cp .env.example .env.local
pnpm dev           # servidor de desarrollo (http://localhost:5173)
pnpm lint          # ESLint + Prettier
pnpm typecheck     # TypeScript estricto
pnpm test          # Vitest + Testing Library + axe-core
pnpm build         # build de producción en dist/
```

## Estructura

- `src/styles/tokens.css`: tokens de diseño (tema oscuro por defecto; el claro está pendiente de CD-01 a CD-03).
- `src/lib/format/`: formato es-CO de montos (cadena decimal → texto, sin aritmética) y fechas.
