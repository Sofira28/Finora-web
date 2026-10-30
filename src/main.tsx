import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { connectApiEvents, createQueryClient } from './app/queryClient.ts'
import { routes } from './app/routes.tsx'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el elemento #root')

const queryClient = createQueryClient()
connectApiEvents(queryClient)
const router = createBrowserRouter(routes)

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
