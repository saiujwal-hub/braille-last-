import { HashRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { AppProvider, ScanProvider, useScan } from './store'
import { HomeScreen } from './screens/HomeScreen'
import { ScanScreen } from './screens/ScanScreen'
import { ResultScreen } from './screens/ResultScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ReaderAnimation } from './components/ReaderAnimation'

function Shell() {
  const navigate = useNavigate()
  return (
    <ScanProvider navigate={navigate}>
      <div className="app">
        <header className="topbar">
          <NavLink to="/" className="brand">
            <span className="brand__mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Braille Bridge
          </NavLink>
          <nav className="nav" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav__link is-active' : 'nav__link')}>
              Home
            </NavLink>
            <NavLink to="/scan" className={({ isActive }) => (isActive ? 'nav__link is-active' : 'nav__link')}>
              Scan
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => (isActive ? 'nav__link is-active' : 'nav__link')}>
              History
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav__link is-active' : 'nav__link')}>
              Settings
            </NavLink>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/scan" element={<ScanScreen />} />
          <Route path="/result" element={<ResultScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>

        <ScanOverlay />
      </div>
    </ScanProvider>
  )
}

function ScanOverlay() {
  const { phase } = useScan()
  if (phase !== 'scanning') return null
  return (
    <div className="scan-overlay" role="status">
      <ReaderAnimation />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  )
}
