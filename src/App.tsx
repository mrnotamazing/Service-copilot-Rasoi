import { MotionConfig } from 'motion/react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { STANDALONE } from './lib/live.ts'
import { usePrefs } from './lib/prefs.ts'
import { useEdgeFlash } from './lib/useAlerts.ts'
import AboutView from './pages/AboutView.tsx'
import Home from './pages/Home.tsx'
import Start from './pages/Start.tsx'
import KitchenView from './pages/KitchenView.tsx'
import ManagerView from './pages/ManagerView.tsx'
import ServerView from './pages/ServerView.tsx'
import DemoView from './pages/DemoView.tsx'

const Router = STANDALONE ? HashRouter : BrowserRouter

export default function App() {
  const { reduceMotion } = usePrefs()
  return (
    // Motion follows the device's reduce-motion setting, or the in-app switch in Comfort & access.
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <TooltipProvider delayDuration={300}>
        <Router>
          <Routes>
            <Route path="/" element={<Start />} />
            <Route path="/servers" element={<Home />} />
            <Route path="/server/:staffId" element={<ServerView />} />
            <Route path="/kitchen" element={<KitchenView />} />
            <Route path="/manager" element={<ManagerView />} />
            <Route path="/setup" element={<Navigate to="/demo?tab=setup" replace />} />
            <Route path="/demo" element={<DemoView />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
        <Toaster position="top-center" />
        <EdgeFlash />
      </TooltipProvider>
    </MotionConfig>
  )
}

/** A visual alert for Deaf and hard-of-hearing staff: the screen edge flashes when something new arrives. */
function EdgeFlash() {
  const n = useEdgeFlash()
  return n ? <div key={n} className="edge-flash pointer-events-none fixed inset-0 z-[100]" aria-hidden /> : null
}
