import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../socket'
import './StudentJoin.css'

function StudentJoin() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = (e) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) {
      setError('Please enter both your name and session code')
      return
    }
    if (code.trim().length < 6) {
      setError('Session code must be 6 characters')
      return
    }

    setLoading(true)
    setError('')

    if (!socket.connected) socket.connect()

    socket.emit('student:join', { code: code.trim(), name: name.trim() }, (response) => {
      setLoading(false)
      if (response.success) {
        navigate('/play', { state: { code: response.code, name: name.trim(), gameMode: response.gameMode } })
      } else {
        setError(response.error || 'Failed to join session')
      }
    })
  }

  return (
    <div className="student-join">
      <div className="student-join-bg">
        <div className="join-orb join-orb-1" />
        <div className="join-orb join-orb-2" />
      </div>

      <div className="student-join-content animate-fade-in-up">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>

        <div className="join-card glass">
          <div className="join-header">
            <span className="join-icon">🎮</span>
            <h1 className="join-title">Join Game</h1>
            <p className="join-subtitle">Enter your name and the session code</p>
          </div>

          <form onSubmit={handleJoin} className="join-form">
            <div className="input-group">
              <label htmlFor="player-name">Your Name</label>
              <input
                id="player-name"
                type="text"
                className="input"
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label htmlFor="session-code">Session Code</label>
              <input
                id="session-code"
                type="text"
                className="input input-lg"
                placeholder="ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </div>

            {error && (
              <div className="join-error animate-shake">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-secondary btn-lg join-submit"
              disabled={loading}
              id="join-submit-btn"
            >
              {loading ? (
                <span className="loading-dots">Joining<span>.</span><span>.</span><span>.</span></span>
              ) : (
                <>🚀 Join Game</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default StudentJoin
