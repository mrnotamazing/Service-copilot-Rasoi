import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { STANDALONE } from './lib/live.ts'
import Home from './pages/Home.tsx'
import KitchenView from './pages/KitchenView.tsx'
import ManagerView from './pages/ManagerView.tsx'
import ServerView from './pages/ServerView.tsx'
import SetupView from './pages/SetupView.tsx'

const Router = STANDALONE ? HashRouter : BrowserRouter

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/server/:staffId" element={<ServerView />} />
        <Route path="/kitchen" element={<KitchenView />} />
        <Route path="/manager" element={<ManagerView />} />
        <Route path="/setup" element={<SetupView />} />
      </Routes>
    </Router>
  )
}
