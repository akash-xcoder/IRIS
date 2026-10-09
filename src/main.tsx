import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyTheme, currentTheme } from './theme'

applyTheme(currentTheme(), false)

// /family is the dashboard for family members; it doesn't need the camera app or its models.
const isFamily = /^\/family\/?$/.test(location.pathname.slice(import.meta.env.BASE_URL.length - 1))
const Page = isFamily
  ? lazy(() => import('./family/FamilyDashboard').then((m) => ({ default: m.FamilyDashboard })))
  : lazy(() => import('./App.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense>
      <Page />
    </Suspense>
  </StrictMode>,
)

// Keeps the app and its models on the device for offline use (see public/sw.js). Production only,
// so the dev server never serves stale code from the cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
