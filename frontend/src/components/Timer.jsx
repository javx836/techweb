import { useState, useEffect, useRef } from 'react'
import './Timer.css'

function Timer({ duration, onTimeUp, isRunning = true }) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const intervalRef = useRef(null)

  useEffect(() => {
    setTimeLeft(duration)
  }, [duration])

  useEffect(() => {
    if (!isRunning) return
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          if (onTimeUp) onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [isRunning, duration, onTimeUp])

  const percentage = (timeLeft / duration) * 100
  const circumference = 2 * Math.PI * 45
  const offset = circumference - (percentage / 100) * circumference

  const getColor = () => {
    if (percentage > 60) return 'var(--success)'
    if (percentage > 30) return 'var(--warning)'
    return 'var(--danger)'
  }

  return (
    <div className={`timer ${timeLeft <= 5 ? 'timer-urgent' : ''}`}>
      <svg className="timer-svg" viewBox="0 0 100 100">
        <circle
          className="timer-bg-circle"
          cx="50" cy="50" r="45"
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
        />
        <circle
          className="timer-progress-circle"
          cx="50" cy="50" r="45"
          fill="none"
          stroke={getColor()}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="timer-text" style={{ color: getColor() }}>
        {timeLeft}
      </span>
    </div>
  )
}

export default Timer
