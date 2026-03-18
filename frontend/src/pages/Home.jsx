import { useNavigate } from 'react-router-dom'
import './Home.css'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="home">
      <div className="home-bg">
        <div className="home-orb home-orb-1" />
        <div className="home-orb home-orb-2" />
        <div className="home-orb home-orb-3" />
      </div>

      <div className="home-content">
        <div className="home-hero animate-fade-in-up">
          <div className="home-logo">
            <span className="home-logo-icon">⚡</span>
            <h1 className="home-title">QuizBlitz</h1>
          </div>
          <p className="home-subtitle">
            Real-time classroom engagement & quiz games
          </p>
          <p className="home-description">
            Host interactive quizzes, rapid-fire rounds, and open-answer sessions.
            Students join instantly with a code — no sign-up needed.
          </p>
        </div>

        <div className="home-actions stagger-children">
          <button
            className="home-card home-card-host"
            onClick={() => navigate('/host')}
            id="host-btn"
          >
            <span className="home-card-icon">🎓</span>
            <span className="home-card-title">Host a Game</span>
            <span className="home-card-desc">Create a session and control the quiz</span>
            <span className="home-card-arrow">→</span>
          </button>

          <button
            className="home-card home-card-join"
            onClick={() => navigate('/join')}
            id="join-btn"
          >
            <span className="home-card-icon">🎮</span>
            <span className="home-card-title">Join a Game</span>
            <span className="home-card-desc">Enter the session code to play</span>
            <span className="home-card-arrow">→</span>
          </button>
        </div>

        <div className="home-features animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div className="home-feature">
            <span>⏱️</span>
            <span>Real-time</span>
          </div>
          <div className="home-feature">
            <span>📊</span>
            <span>Live Leaderboard</span>
          </div>
          <div className="home-feature">
            <span>🎯</span>
            <span>Multiple Modes</span>
          </div>
          <div className="home-feature">
            <span>📱</span>
            <span>Mobile Ready</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
