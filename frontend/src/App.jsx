import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import HostDashboard from './pages/HostDashboard'
import StudentJoin from './pages/StudentJoin'
import StudentPlay from './pages/StudentPlay'
import ThemeToggle from './components/ThemeToggle'

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('quizblitz-theme') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('quizblitz-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="app">
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<HostDashboard />} />
        <Route path="/join" element={<StudentJoin />} />
        <Route path="/play" element={<StudentPlay />} />
      </Routes>
    </div>
  )
}

export default App
