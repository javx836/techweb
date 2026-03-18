import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import socket from '../socket'
import Timer from '../components/Timer'
import Confetti from '../components/Confetti'
import Leaderboard from '../components/Leaderboard'
import { playCorrect, playWrong, playWinner } from '../utils/sounds'
import './StudentPlay.css'

function StudentPlay() {
  const location = useLocation()
  const navigate = useNavigate()
  const { code, name, gameMode } = location.state || {}

  const [phase, setPhase] = useState('waiting') // waiting, question, answered, results, finished, kicked
  const [question, setQuestion] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (!code || !name) {
      navigate('/join')
      return
    }

    const onGameStarted = () => {
      setPhase('waiting')
    }

    const onQuestion = (data) => {
      setQuestion(data)
      setSelectedAnswer(null)
      setTextAnswer('')
      setFeedback(null)
      setPhase('question')
    }

    const onAnswerResult = (data) => {
      setFeedback(data)
      setPhase('answered')
      if (data.isCorrect) {
        playCorrect()
      } else {
        playWrong()
      }
    }

    const onTimeUp = (data) => {
      setLeaderboard(data.leaderboard)
      if (phase === 'question') {
        setFeedback({ isCorrect: false, correctAnswer: data.correctAnswer, score: 0, totalScore: feedback?.totalScore || 0 })
      }
      setPhase('results')
    }

    const onAllAnswered = (data) => {
      setLeaderboard(data.leaderboard)
      setPhase('results')
    }

    const onGameFinished = (data) => {
      setLeaderboard(data.leaderboard)
      setShowConfetti(true)
      playWinner()
      setPhase('finished')
    }

    const onKicked = () => {
      setPhase('kicked')
    }

    const onHostDisconnected = () => {
      setPhase('kicked')
    }

    socket.on('game:started', onGameStarted)
    socket.on('game:question', onQuestion)
    socket.on('student:answerResult', onAnswerResult)
    socket.on('game:timeUp', onTimeUp)
    socket.on('game:allAnswered', onAllAnswered)
    socket.on('game:finished', onGameFinished)
    socket.on('game:kicked', onKicked)
    socket.on('game:hostDisconnected', onHostDisconnected)

    return () => {
      socket.off('game:started', onGameStarted)
      socket.off('game:question', onQuestion)
      socket.off('student:answerResult', onAnswerResult)
      socket.off('game:timeUp', onTimeUp)
      socket.off('game:allAnswered', onAllAnswered)
      socket.off('game:finished', onGameFinished)
      socket.off('game:kicked', onKicked)
      socket.off('game:hostDisconnected', onHostDisconnected)
    }
  }, [code, name, navigate])

  const submitAnswer = (answer) => {
    if (!answer || phase !== 'question') return
    setSelectedAnswer(answer)
    socket.emit('student:answer', { code, answer })
  }

  const handleTextSubmit = (e) => {
    e.preventDefault()
    if (textAnswer.trim()) {
      submitAnswer(textAnswer.trim())
    }
  }

  const getMyRank = () => {
    const myEntry = leaderboard.find((_, i) => {
      return leaderboard[i]?.name === name
    })
    if (!myEntry) return null
    return leaderboard.indexOf(myEntry) + 1
  }

  const myScore = leaderboard.find(p => p.name === name)?.score || 0

  // ─── Kicked / Disconnected ───
  if (phase === 'kicked') {
    return (
      <div className="student-play">
        <div className="play-center">
          <div className="kicked-view animate-scale-in">
            <span className="kicked-icon">😔</span>
            <h2>You've been disconnected</h2>
            <p>You were removed from the session or the host ended the game.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Home</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Waiting ───
  if (phase === 'waiting') {
    return (
      <div className="student-play">
        <div className="play-center">
          <div className="waiting-view animate-fade-in">
            <div className="waiting-avatar animate-float">
              {name?.charAt(0).toUpperCase()}
            </div>
            <h2 className="waiting-name">Hey, {name}! 👋</h2>
            <p className="waiting-message">Waiting for the host to start the game...</p>
            <div className="waiting-code">
              Session: <strong>{code}</strong>
            </div>
            <div className="waiting-dots">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Question ───
  if (phase === 'question' && question) {
    return (
      <div className="student-play">
        <div className="play-content">
          <div className="question-top">
            <div className="question-info">
              <span className="badge badge-primary">
                Q{question.questionNumber}/{question.totalQuestions}
              </span>
            </div>
            <Timer
              duration={question.timeLimit}
              isRunning={true}
              key={question.id}
            />
          </div>

          <h2 className="play-question-text animate-fade-in-up">{question.text}</h2>

          {question.type === 'open' ? (
            <form onSubmit={handleTextSubmit} className="open-answer-form animate-fade-in-up">
              <input
                type="text"
                className="input input-lg"
                placeholder="Type your answer..."
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                autoFocus
                disabled={selectedAnswer !== null}
              />
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={!textAnswer.trim() || selectedAnswer !== null}
                style={{ width: '100%' }}
              >
                Submit Answer
              </button>
            </form>
          ) : (
            <div className="play-options stagger-children">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  className={`play-option play-option-${i} ${selectedAnswer === opt ? 'play-option-selected' : ''}`}
                  onClick={() => submitAnswer(opt)}
                  disabled={selectedAnswer !== null}
                >
                  <span className="play-option-letter">{String.fromCharCode(65 + i)}</span>
                  <span className="play-option-text">{opt}</span>
                </button>
              ))}
            </div>
          )}

          {selectedAnswer && (
            <div className="play-submitted animate-bounce-in">
              ✅ Answer submitted! Waiting...
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Answered / Feedback ───
  if (phase === 'answered' && feedback) {
    return (
      <div className="student-play">
        <div className="play-center">
          <div className={`feedback-view animate-scale-in ${feedback.isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
            <span className="feedback-icon">
              {feedback.isCorrect ? '🎉' : '😞'}
            </span>
            <h2 className="feedback-title">
              {feedback.isCorrect ? 'Correct!' : 'Wrong!'}
            </h2>
            {!feedback.isCorrect && (
              <p className="feedback-answer">
                Correct answer: <strong>{feedback.correctAnswer}</strong>
              </p>
            )}
            <div className="feedback-score">
              <span className="feedback-points">+{feedback.score}</span>
              <span className="feedback-total">Total: {feedback.totalScore}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Results (between questions) ───
  if (phase === 'results') {
    const rank = getMyRank()
    return (
      <div className="student-play">
        <div className="play-center">
          <div className="results-view animate-fade-in">
            <div className="my-rank">
              <span className="rank-number">#{rank || '?'}</span>
              <span className="rank-label">Your Rank</span>
              <span className="rank-score">{myScore.toLocaleString()} pts</span>
            </div>
            <p className="results-waiting">Get ready for the next question...</p>
            <div className="waiting-dots">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Finished ───
  if (phase === 'finished') {
    const rank = getMyRank()
    return (
      <div className="student-play">
        <Confetti active={showConfetti} duration={5000} />
        <div className="play-center">
          <div className="finish-view animate-fade-in">
            <div className="finish-header">
              {rank === 1 ? (
                <>
                  <span className="finish-trophy animate-bounce-in">🏆</span>
                  <h2 className="finish-title">You Won!</h2>
                </>
              ) : rank && rank <= 3 ? (
                <>
                  <span className="finish-trophy animate-bounce-in">{rank === 2 ? '🥈' : '🥉'}</span>
                  <h2 className="finish-title">Great job!</h2>
                </>
              ) : (
                <>
                  <span className="finish-trophy">👏</span>
                  <h2 className="finish-title">Game Over</h2>
                </>
              )}
              <div className="finish-rank">
                #{rank || '?'} • {myScore.toLocaleString()} points
              </div>
            </div>
            <Leaderboard leaderboard={leaderboard} title="Final Standings" />
            <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: '24px' }}>
              🏠 Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default StudentPlay
