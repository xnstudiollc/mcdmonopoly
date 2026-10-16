import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Footer } from './components/Footer.tsx'
import { Header } from './components/Header.tsx'
import { dataErrors } from './engine/data.ts'
import { BoardPage } from './pages/BoardPage.tsx'
import { Home } from './pages/Home.tsx'
import { PrizeGuide } from './pages/PrizeGuide.tsx'

const PeelView = lazy(() => import('./pages/PeelView.tsx').then((m) => ({ default: m.PeelView })))
const PeelLab = lazy(() => import('./pages/PeelLab.tsx').then((m) => ({ default: m.PeelLab })))

function DataErrors() {
  return (
    <main className="page data-errors">
      <h1>Game data is invalid</h1>
      <p>Fix these problems in <code>src/data/*.json</code> (or rerun <code>npm run data</code>):</p>
      <ul>
        {dataErrors.map((e) => (
          <li key={e}>
            <code>{e}</code>
          </li>
        ))}
      </ul>
    </main>
  )
}

export function App() {
  return (
    <div className="app">
      <Header />
      {dataErrors.length > 0 ? (
        <DataErrors />
      ) : (
        <Suspense fallback={<main className="page page--center muted">Loading…</main>}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/item/:itemId" element={<PeelView />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/prizes" element={<PrizeGuide />} />
          <Route path="/peel-lab" element={<PeelLab />} />
          <Route
            path="*"
            element={
              <main className="page page--center">
                <h1>Page not found</h1>
              </main>
            }
          />
          </Routes>
        </Suspense>
      )}
      <Footer />
    </div>
  )
}
