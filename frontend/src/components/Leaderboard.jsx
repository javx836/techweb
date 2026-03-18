import './Leaderboard.css'

function Leaderboard({ leaderboard = [], showPodium = true, title = "Leaderboard" }) {
  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  const medals = ['🥇', '🥈', '🥉']
  const podiumOrder = [1, 0, 2]

  return (
    <div className="leaderboard animate-fade-in">
      <h2 className="leaderboard-title">{title}</h2>

      {showPodium && top3.length > 0 && (
        <div className="podium">
          {podiumOrder.map((idx) => {
            const player = top3[idx]
            if (!player) return <div key={idx} className="podium-slot podium-empty" />
            return (
              <div
                key={player.id || idx}
                className={`podium-slot podium-${idx + 1}`}
                style={{ animationDelay: `${idx * 200}ms` }}
              >
                <div className="podium-medal animate-bounce-in" style={{ animationDelay: `${idx * 200 + 300}ms` }}>
                  {medals[idx]}
                </div>
                <div className="podium-name">{player.name}</div>
                <div className="podium-score">{player.score.toLocaleString()}</div>
                <div className={`podium-bar podium-bar-${idx + 1}`} />
              </div>
            )
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className="leaderboard-list stagger-children">
          {rest.map((player, i) => (
            <div key={player.id || i} className="leaderboard-row">
              <span className="leaderboard-rank">{i + 4}</span>
              <span className="leaderboard-name">{player.name}</span>
              <span className="leaderboard-score">{player.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {leaderboard.length === 0 && (
        <p className="leaderboard-empty">No scores yet</p>
      )}
    </div>
  )
}

export default Leaderboard
