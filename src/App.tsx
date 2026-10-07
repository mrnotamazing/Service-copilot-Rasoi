import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.tsx'
import KitchenView from './pages/KitchenView.tsx'
import ManagerView from './pages/ManagerView.tsx'
import ServerView from './pages/ServerView.tsx'
import SetupView from './pages/SetupView.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/server/:staffId" element={<ServerView />} />
        <Route path="/kitchen" element={<KitchenView />} />
        <Route path="/manager" element={<ManagerView />} />
        <Route path="/setup" element={<SetupView />} />
      </Routes>
    </BrowserRouter>
  )
}
