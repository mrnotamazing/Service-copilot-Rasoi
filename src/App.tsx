import { MotionConfig } from 'motion/react'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { STANDALONE } from './lib/live.ts'
import AboutView from './pages/AboutView.tsx'
import Home from './pages/Home.tsx'
import KitchenView from './pages/KitchenView.tsx'
import ManagerView from './pages/ManagerView.tsx'
import ServerView from './pages/ServerView.tsx'
import SetupView from './pages/SetupView.tsx'

const Router = STANDALONE ? HashRouter : BrowserRouter

export default function App() {
  return (
    // Motion follows the device's reduce-motion setting.
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/server/:staffId" element={<ServerView />} />
            <Route path="/kitchen" element={<KitchenView />} />
            <Route path="/manager" element={<ManagerView />} />
            <Route path="/setup" element={<SetupView />} />
            <Route path="/about" element={<AboutView />} />
          </Routes>
        </Router>
        <Toaster position="top-center" />
      </TooltipProvider>
    </MotionConfig>
  )
}
