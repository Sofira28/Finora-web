# finora-web

Aplicación frontend de FINORA.

## Responsabilidad

- Interfaz de usuario en español colombiano (`es-CO`), con montos en COP y fechas en DD/MM/AAAA.
- Implementación fiel del diseño aprobado en Claude Design (ver `../docs/guides/claude-design.md`).
- Accesibilidad WCAG 2.2 AA y comportamiento responsive (escritorio, tablet y móvil).
- Consumo de la API según `../specs/api-contracts.md`. La validación en el cliente es solo una ayuda al usuario.

## Estado

**Stack:** TypeScript + React + Vite ([ADR-0001](../docs/decisions/ADR-0001-stack-tecnologico.md)). Esta aplicación es independiente de `finora-back`.

Implementado: pantallas de autenticación y perfil (`authentication`): registro y verificación de correo, inicio de sesión (con código de verificación en dos pasos y vinculación de Google), recuperación de contraseña, política de datos y perfil (nombre, contraseña, verificación en dos pasos y eliminación de la cuenta). La página de inicio es provisional; aún sin módulos financieros.

## Requisitos

- Node.js 22 o superior
- pnpm (`npm install -g pnpm`)
- `finora-back` corriendo para usar la aplicación (ver su README)

## Desarrollo local

```bash
pnpm install               # instalar dependencias
cp .env.example .env.local
pnpm dev                   # http://localhost:5173
```

El navegador siempre llama a `/api` en el mismo origen (la cookie de sesión es del sitio). En desarrollo, Vite reenvía `/api` a `FINORA_API_PROXY_TARGET` (por defecto `http://localhost:8000`); esa variable solo la lee Vite y no llega al navegador. Los correos de prueba (verificación, recuperación) se leen en Mailpit: http://localhost:8025.

## Comandos

```bash
pnpm lint          # ESLint + Prettier
pnpm typecheck     # TypeScript estricto
pnpm test          # Vitest + Testing Library + axe-core (src/)
pnpm build         # build de producción en dist/
pnpm api:types     # regenera src/lib/api/schema.d.ts desde el OpenAPI (backend en :8000)
pnpm test:e2e      # Playwright de extremo a extremo (ver abajo)
```

## Pruebas de extremo a extremo

`pnpm test:e2e` (Playwright, Chromium) recorre los flujos reales y revisa la accesibilidad (axe WCAG 2.2 AA, reflow a 320 px, foco visible). Requisitos:

```bash
pnpm exec playwright install chromium                   # una vez
(cd ../finora-back && uv sync && docker compose up -d db mailpit)
```

La prueba levanta su propio backend en el puerto 8001 con una base de datos `finora_e2e` que recrea en cada corrida (`e2e/backend.sh`; la de desarrollo no se toca), y Vite en el 5174, así que no choca con los servidores de desarrollo. Usa una clave de MFA nueva, Google desactivado y límites por IP altos. Tarda unos 4 minutos: los códigos TOTP no se pueden reutilizar y a veces hay que esperar al siguiente intervalo. Los resultados quedan en `test-results/` y `playwright-report/` (ignorados por Git).

## Estructura

- `src/app/`: rutas (`routes.tsx`, con carga diferida del perfil) y cliente de TanStack Query.
- `src/features/auth/`: pantallas y API por flujo (`register`, `verify-email`, `login`, `password-recovery`, `profile`, `privacy`); `session/` maneja la sesión, las rutas protegidas y los avisos al perderla.
- `src/components/`: componentes compartidos (`Button`, `TextField`, `PasswordField`, `OtpField`, `Dialog`, `Alert`, `AuthLayout`…).
- `src/lib/api/`: cliente HTTP (cookie de sesión, token anti-CSRF, errores RFC 9457) y tipos generados del OpenAPI.
- `src/lib/format/`: formato es-CO de montos (cadena decimal → texto, sin aritmética) y fechas.
- `src/styles/tokens.css`: tokens de diseño (tema oscuro por defecto; el claro está pendiente de CD-01 a CD-03).
- `e2e/`: pruebas de Playwright y sus utilidades (Mailpit, TOTP, accesibilidad).
