import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import socket, { BACKEND_URL } from '../socket'
import Timer from '../components/Timer'
import Leaderboard from '../components/Leaderboard'
import Confetti from '../components/Confetti'
import { playJoin, playCorrect, playWinner } from '../utils/sounds'
import './HostDashboard.css'

const SAMPLE_QUESTIONS = [
  {
    text: 'What is the capital of France?',
    type: 'mcq',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctAnswer: 'Paris',
    timeLimit: 20,
  },
  {
    text: 'Which planet is known as the Red Planet?',
    type: 'mcq',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctAnswer: 'Mars',
    timeLimit: 15,
  },
  {
    text: 'What is 12 × 8?',
    type: 'open',
    options: [],
    correctAnswer: '96',
    timeLimit: 15,
  },
  {
    text: 'Who painted the Mona Lisa?',
    type: 'rapid',
    options: ['Michelangelo', 'Da Vinci', 'Raphael', 'Donatello'],
    correctAnswer: 'Da Vinci',
    timeLimit: 10,
  },
  {
    text: 'What gas do plants absorb from the atmosphere?',
    type: 'mcq',
    options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
    correctAnswer: 'Carbon Dioxide',
    timeLimit: 20,
  },
]

function HostDashboard() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('setup') // setup, lobby, question, leaderboard, finished
  const [sessionCode, setSessionCode] = useState('')
  const [participants, setParticipants] = useState([])
  const [questions, setQuestions] = useState(SAMPLE_QUESTIONS)
  const [gameMode, setGameMode] = useState('quiz')
  const [timerDuration, setTimerDuration] = useState(20)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [answers, setAnswers] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [rapidFireWinner, setRapidFireWinner] = useState(null)
  const [questionCount, setQuestionCount] = useState({ current: 0, total: 0 })

  // New question form state
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [newQ, setNewQ] = useState({ text: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '', timeLimit: 20 })

  const handleCreateSession = useCallback(() => {
    if (!socket.connected) socket.connect()

    socket.emit('host:create', { gameMode, timerDuration }, (response) => {
      if (response.success) {
        setSessionCode(response.code)
        socket.emit('host:addQuestions', { code: response.code, questions })
        setPhase('lobby')
      }
    })
  }, [gameMode, timerDuration, questions])

  useEffect(() => {
    const onParticipantJoined = (data) => {
      setParticipants(data.participants)
      playJoin()
    }

    const onParticipantLeft = (data) => {
      setParticipants(data.participants)
    }

    const onQuestionData = (data) => {
      setCurrentQuestion(data)
      setAnswers([])
      setRapidFireWinner(null)
      setQuestionCount({ current: data.questionNumber, total: data.totalQuestions })
      setPhase('question')
    }

    const onAnswerReceived = (data) => {
      setAnswers(prev => [...prev, data])
      if (data.isCorrect) playCorrect()
    }

    const onTimeUp = (data) => {
      setLeaderboard(data.leaderboard)
      setPhase('leaderboard')
    }

    const onAllAnswered = (data) => {
      setLeaderboard(data.leaderboard)
      setPhase('leaderboard')
    }

    const onRapidFireWinner = (data) => {
      setRapidFireWinner(data)
      playWinner()
    }

    const onGameFinished = (data) => {
      setLeaderboard(data.leaderboard)
      setShowConfetti(true)
      playWinner()
      setPhase('finished')
    }

    socket.on('game:participantJoined', onParticipantJoined)
    socket.on('game:participantLeft', onParticipantLeft)
    socket.on('host:questionData', onQuestionData)
    socket.on('host:answerReceived', onAnswerReceived)
    socket.on('game:timeUp', onTimeUp)
    socket.on('game:allAnswered', onAllAnswered)
    socket.on('game:rapidFireWinner', onRapidFireWinner)
    socket.on('game:finished', onGameFinished)

    return () => {
      socket.off('game:participantJoined', onParticipantJoined)
      socket.off('game:participantLeft', onParticipantLeft)
      socket.off('host:questionData', onQuestionData)
      socket.off('host:answerReceived', onAnswerReceived)
      socket.off('game:timeUp', onTimeUp)
      socket.off('game:allAnswered', onAllAnswered)
      socket.off('game:rapidFireWinner', onRapidFireWinner)
      socket.off('game:finished', onGameFinished)
    }
  }, [])

  const startGame = () => {
    socket.emit('host:startGame', { code: sessionCode })
    nextQuestion()
  }

  const nextQuestion = () => {
    socket.emit('host:nextQuestion', { code: sessionCode })
  }

  const kickPlayer = (id) => {
    socket.emit('host:kick', { code: sessionCode, participantId: id })
  }

  const endGame = () => {
    socket.emit('host:endGame', { code: sessionCode })
  }

  const exportResults = () => {
    window.open(`${BACKEND_URL}/api/export/${sessionCode}`, '_blank')
  }

  const addQuestion = () => {
    if (!newQ.text.trim() || !newQ.correctAnswer.trim()) return
    const q = { ...newQ, options: newQ.type === 'open' ? [] : newQ.options.filter(o => o.trim()) }
    setQuestions(prev => [...prev, q])
    setNewQ({ text: '', type: 'mcq', options: ['', '', '', ''], correctAnswer: '', timeLimit: 20 })
    setShowAddQuestion(false)
  }

  const removeQuestion = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const getModeLabel = (type) => {
    if (type === 'mcq') return 'MCQ'
    if (type === 'rapid') return 'Rapid Fire'
    return 'Open Answer'
  }

  const getModeEmoji = (type) => {
    if (type === 'mcq') return '📝'
    if (type === 'rapid') return '⚡'
    return '✏️'
  }

  const fastestCorrect = answers
    .filter(a => a.isCorrect)
    .sort((a, b) => a.answerTime - b.answerTime)[0]

  // ─── Setup Phase ───
  if (phase === 'setup') {
    return (
      <div className="host">
        <div className="host-bg"><div className="host-orb host-orb-1" /><div className="host-orb host-orb-2" /></div>
        <div className="host-content">
          <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
          <div className="setup-card glass animate-fade-in-up">
            <h1 className="setup-title">⚡ Create Session</h1>

            <div className="setup-section">
              <h3>Game Mode</h3>
              <div className="mode-selector">
                {[
                  { value: 'quiz', label: 'Quiz Mode', icon: '📝', desc: 'Multiple choice questions' },
                  { value: 'rapid', label: 'Rapid Fire', icon: '⚡', desc: 'First correct answer wins' },
                  { value: 'open', label: 'Open Answer', icon: '✏️', desc: 'Students type answers' },
                ].map(mode => (
                  <button
                    key={mode.value}
                    className={`mode-card ${gameMode === mode.value ? 'mode-card-active' : ''}`}
                    onClick={() => setGameMode(mode.value)}
                  >
                    <span className="mode-icon">{mode.icon}</span>
                    <span className="mode-label">{mode.label}</span>
                    <span className="mode-desc">{mode.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="setup-section">
              <h3>Questions ({questions.length})</h3>
              <div className="questions-list">
                {questions.map((q, i) => (
                  <div key={i} className="question-preview">
                    <span className="question-preview-num">{i + 1}</span>
                    <div className="question-preview-content">
                      <span className="question-preview-text">{q.text}</span>
                      <span className="badge badge-primary">{getModeEmoji(q.type)} {getModeLabel(q.type)}</span>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => removeQuestion(i)}>✕</button>
                  </div>
                ))}
              </div>

              {showAddQuestion ? (
                <div className="add-question-form card animate-scale-in">
                  <div className="input-group">
                    <label>Question</label>
                    <input className="input" placeholder="Enter question..." value={newQ.text} onChange={e => setNewQ({...newQ, text: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Type</label>
                    <select className="input" value={newQ.type} onChange={e => setNewQ({...newQ, type: e.target.value})}>
                      <option value="mcq">Multiple Choice</option>
                      <option value="rapid">Rapid Fire</option>
                      <option value="open">Open Answer</option>
                    </select>
                  </div>
                  {newQ.type !== 'open' && (
                    <div className="input-group">
                      <label>Options</label>
                      {newQ.options.map((opt, i) => (
                        <input key={i} className="input" placeholder={`Option ${i + 1}`} value={opt}
                          onChange={e => { const opts = [...newQ.options]; opts[i] = e.target.value; setNewQ({...newQ, options: opts}) }} />
                      ))}
                    </div>
                  )}
                  <div className="input-group">
                    <label>Correct Answer</label>
                    <input className="input" placeholder="Correct answer..." value={newQ.correctAnswer} onChange={e => setNewQ({...newQ, correctAnswer: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Time Limit (seconds)</label>
                    <input className="input" type="number" min="5" max="120" value={newQ.timeLimit} onChange={e => setNewQ({...newQ, timeLimit: parseInt(e.target.value) || 20})} />
                  </div>
                  <div className="add-question-actions">
                    <button className="btn btn-primary btn-sm" onClick={addQuestion}>Add Question</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddQuestion(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-ghost" onClick={() => setShowAddQuestion(true)} style={{ width: '100%' }}>
                  + Add Question
                </button>
              )}
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={handleCreateSession}
              disabled={questions.length === 0}
              style={{ width: '100%' }}
              id="create-session-btn"
            >
              🚀 Create Session
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Lobby Phase ───
  if (phase === 'lobby') {
    return (
      <div className="host">
        <div className="host-bg"><div className="host-orb host-orb-1" /><div className="host-orb host-orb-2" /></div>
        <div className="host-content host-content-wide">
          <div className="lobby animate-fade-in">
            <div className="lobby-header">
              <h1 className="lobby-title">Waiting for Players</h1>
              <div className="session-code-display">
                <span className="session-code-label">Session Code</span>
                <span className="session-code animate-pulse">{sessionCode}</span>
              </div>
              <p className="lobby-hint">Share this code with your students</p>
            </div>

            <div className="lobby-body">
              <div className="participants-section">
                <h3>Players ({participants.length})</h3>
                <div className="participants-grid stagger-children">
                  {participants.map((p) => (
                    <div key={p.id} className="participant-chip">
                      <span className="participant-avatar">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="participant-name">{p.name}</span>
                      <button className="participant-kick" onClick={() => kickPlayer(p.id)} title="Remove">✕</button>
                    </div>
                  ))}
                  {participants.length === 0 && (
                    <p className="waiting-text animate-pulse">Waiting for players to join...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lobby-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={startGame}
                disabled={participants.length === 0}
                id="start-game-btn"
              >
                ▶ Start Game ({questions.length} Questions)
              </button>
              <button className="btn btn-ghost" onClick={exportResults}>
                📥 Export
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Question Phase ───
  if (phase === 'question' && currentQuestion) {
    return (
      <div className="host">
        <div className="host-content host-content-wide">
          <div className="question-view animate-fade-in">
            <div className="question-header">
              <div className="question-meta">
                <span className="badge badge-primary">
                  {getModeEmoji(currentQuestion.type)} {getModeLabel(currentQuestion.type)}
                </span>
                <span className="question-counter">
                  {questionCount.current} / {questionCount.total}
                </span>
              </div>
              <Timer
                duration={currentQuestion.timeLimit}
                isRunning={true}
                key={currentQuestion.id}
              />
            </div>

            <div className="question-display">
              <h1 className="question-text animate-scale-in">{currentQuestion.text}</h1>

              {currentQuestion.options && currentQuestion.options.length > 0 && (
                <div className="question-options stagger-children">
                  {currentQuestion.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`question-option ${opt === currentQuestion.correctAnswer ? 'question-option-correct' : ''}`}
                    >
                      <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                      <span className="option-text">{opt}</span>
                      {opt === currentQuestion.correctAnswer && <span className="option-check">✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live answers stream */}
            <div className="answers-stream">
              <div className="answers-header">
                <h3>Responses ({answers.length} / {participants.length})</h3>
                {fastestCorrect && (
                  <div className="fastest-badge animate-bounce-in">
                    ⚡ Fastest: {fastestCorrect.playerName} ({(fastestCorrect.answerTime / 1000).toFixed(1)}s)
                  </div>
                )}
              </div>
              <div className="answers-bar">
                <div
                  className="answers-bar-fill answers-bar-correct"
                  style={{ width: `${(answers.filter(a => a.isCorrect).length / Math.max(participants.length, 1)) * 100}%` }}
                />
                <div
                  className="answers-bar-fill answers-bar-wrong"
                  style={{ width: `${(answers.filter(a => !a.isCorrect).length / Math.max(participants.length, 1)) * 100}%` }}
                />
              </div>
              <div className="answers-list">
                {answers.slice(-6).reverse().map((a, i) => (
                  <div key={i} className={`answer-chip ${a.isCorrect ? 'answer-correct' : 'answer-wrong'} animate-slide-in`}>
                    <span>{a.playerName}</span>
                    <span>{a.isCorrect ? '✓' : '✕'}</span>
                  </div>
                ))}
              </div>
            </div>

            {rapidFireWinner && (
              <div className="rapid-winner animate-bounce-in">
                ⚡ {rapidFireWinner.name} wins this round! ({(rapidFireWinner.answerTime / 1000).toFixed(1)}s)
              </div>
            )}

            <div className="question-actions">
              <button className="btn btn-primary" onClick={nextQuestion}>
                Next Question →
              </button>
              <button className="btn btn-danger btn-sm" onClick={endGame}>
                End Game
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Leaderboard Phase ───
  if (phase === 'leaderboard') {
    return (
      <div className="host">
        <div className="host-content host-content-wide">
          <div className="leaderboard-view animate-fade-in">
            <Leaderboard leaderboard={leaderboard} title="Current Standings" />
            <div className="leaderboard-actions">
              <button className="btn btn-primary btn-lg" onClick={nextQuestion}>
                Next Question →
              </button>
              <button className="btn btn-danger btn-sm" onClick={endGame}>
                End Game
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Finished Phase ───
  if (phase === 'finished') {
    return (
      <div className="host">
        <Confetti active={showConfetti} duration={5000} />
        <div className="host-content host-content-wide">
          <div className="finished-view animate-fade-in">
            <div className="winner-banner animate-bounce-in">
              <span className="winner-trophy">🏆</span>
              <h1 className="winner-title">Game Over!</h1>
              {leaderboard[0] && (
                <div className="winner-name">
                  🎉 {leaderboard[0].name} wins with {leaderboard[0].score.toLocaleString()} points!
                </div>
              )}
            </div>
            <Leaderboard leaderboard={leaderboard} title="Final Results" />
            <div className="finished-actions">
              <button className="btn btn-secondary" onClick={exportResults}>
                📥 Export Results
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                🏠 Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default HostDashboard
