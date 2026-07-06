import { useEffect, useMemo, useState } from 'react'
import './App.css'

const LANGUAGES = [
  { code: 'ja-JP', label: '日本語' },
  { code: 'en-US', label: 'English' },
  { code: 'zh-CN', label: '中文' },
]

const PLAYERS = {
  server: { key: 'server', label: 'サーバー', english: 'Server', theme: 'blue' },
  receiver: { key: 'receiver', label: 'レシーバー', english: 'Receiver', theme: 'red' },
}

function formatClock(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function getLead(scores) {
  if (scores.server === scores.receiver) return null
  return scores.server > scores.receiver ? PLAYERS.server : PLAYERS.receiver
}

function isGameOver(scores, targetScore) {
  const high = Math.max(scores.server, scores.receiver)
  const gap = Math.abs(scores.server - scores.receiver)
  return high >= targetScore && gap >= 2
}

function buildScoreCall(scores, language) {
  if (language === 'ja-JP') return `${scores.server}対${scores.receiver}`
  if (language === 'zh-CN') return scores.server === scores.receiver ? `${scores.server}平${scores.receiver}` : `${scores.server}比${scores.receiver}`
  return `${scores.server} to ${scores.receiver}`
}

function buildSpeech(scores, language, winner = null) {
  if (winner) {
    if (language === 'ja-JP') return `ゲーム${winner.label}`
    if (language === 'zh-CN') return winner.key === 'server' ? '发球方获胜' : '接球方获胜'
    return `Game ${winner.english}`
  }
  return buildScoreCall(scores, language)
}

function buildSpokenSpeech(scores, language, winner = null) {
  if (winner) return buildSpeech(scores, language, winner)
  if (language === 'en-US') return `${scores.server}, to, ${scores.receiver}`
  return buildSpeech(scores, language)
}

function chooseVoice(language) {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  if (language === 'en-US') {
    const preferred = ['Samantha', 'Alex', 'Google US English', 'Microsoft Jenny', 'Microsoft Aria', 'Daniel']
    return preferred.map((name) => voices.find((voice) => voice.lang.startsWith('en') && voice.name.includes(name))).find(Boolean) || voices.find((voice) => voice.lang === 'en-US') || voices.find((voice) => voice.lang.startsWith('en')) || null
  }
  return voices.find((voice) => voice.lang === language) || voices.find((voice) => voice.lang.startsWith(language.slice(0, 2))) || null
}

function speak(text, language) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = language
  utterance.voice = chooseVoice(language)
  utterance.rate = language === 'en-US' ? 0.78 : language === 'zh-CN' ? 0.9 : 0.95
  utterance.pitch = language === 'en-US' ? 1.05 : 1
  window.speechSynthesis.speak(utterance)
}

function Icon({ type }) {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    undo: 'M9 7H4v5m.5-.5A8 8 0 1 0 7 5.7',
    reset: 'M4 4v6h6M20 20v-6h-6M5 14a7 7 0 0 0 12 4M19 10A7 7 0 0 0 7 6',
    volume: 'M4 10v4h4l5 4V6L8 10H4Zm12-2a5 5 0 0 1 0 8m2.5-10.5a8 8 0 0 1 0 13',
    trophy: 'M8 4h8v3a4 4 0 0 1-8 0V4Zm0 1H5v2a3 3 0 0 0 3 3m8-5h3v2a3 3 0 0 1-3 3m-4 3v4m-3 0h6m-8 3h10',
  }
  return <svg aria-hidden="true" className="icon" viewBox="0 0 24 24"><path d={paths[type]} /></svg>
}

function App() {
  const [scores, setScores] = useState({ server: 0, receiver: 0 })
  const [actionStack, setActionStack] = useState([])
  const [language, setLanguage] = useState('ja-JP')
  const [clock, setClock] = useState(222)
  const [lastCall, setLastCall] = useState('Ready')
  const [targetScore, setTargetScore] = useState(10)
  const [theme, setTheme] = useState(() => localStorage.getItem('charlie-theme') || 'light')
  const winner = useMemo(() => (isGameOver(scores, targetScore) ? getLead(scores) : null), [scores, targetScore])
  const leader = useMemo(() => getLead(scores), [scores])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('charlie-theme', theme)
  }, [theme])

  function announce(nextScores, nextLanguage = language, nextWinner = null) {
    const text = buildSpeech(nextScores, nextLanguage, nextWinner)
    setLastCall(text)
    speak(buildSpokenSpeech(nextScores, nextLanguage, nextWinner), nextLanguage)
  }

  function addPoint(playerKey) {
    if (winner) return
    setScores((current) => {
      const next = { ...current, [playerKey]: current[playerKey] + 1 }
      const nextWinner = isGameOver(next, targetScore) ? getLead(next) : null
      setActionStack((items) => [{ id: crypto.randomUUID(), delta: 1, player: playerKey }, ...items].slice(0, 20))
      announce(next, language, nextWinner)
      return next
    })
  }

  function resetMatch() {
    const next = { server: 0, receiver: 0 }
    setScores(next)
    setActionStack([])
    setClock(0)
    setLastCall('New match')
    speak(language === 'ja-JP' ? '新しい試合です' : language === 'zh-CN' ? '新比赛开始' : 'New match', language)
  }

  function updateTargetScore(value) {
    const nextValue = Math.min(99, Math.max(1, Number(value) || 1))
    setTargetScore(nextValue)
    setLastCall(`${nextValue} point match`)
  }

  function undo() {
    const last = actionStack[0]
    if (!last) return
    setScores((current) => {
      const next = { ...current, [last.player]: Math.max(0, current[last.player] - last.delta) }
      setActionStack((items) => items.slice(1))
      announce(next)
      return next
    })
  }

  function callAllLanguages() {
    LANGUAGES.forEach((item, index) => window.setTimeout(() => speak(buildSpokenSpeech(scores, item.code, winner), item.code), index * 1800))
    setLastCall('JA / EN / ZH')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">C</span><div><h1>Charlie Scoreboard</h1><p>日本語 / English / 中文</p></div></div>
        <div className="top-controls"><div className="theme-switcher" aria-label="Color theme">{['light', 'dark'].map((item) => <button key={item} className={theme === item ? 'selected' : ''} type="button" onClick={() => setTheme(item)}>{item === 'light' ? 'Light' : 'Dark'}</button>)}</div><div className="language-switcher" aria-label="Voice language">{LANGUAGES.map((item) => <button key={item.code} className={language === item.code ? 'selected' : ''} type="button" onClick={() => setLanguage(item.code)}>{item.label}</button>)}</div></div>
      </header>
      <section className="status-strip">
        <div className="timer"><span>Match</span><strong>{formatClock(clock)}</strong><button type="button" onClick={() => setClock((value) => value + 1)} aria-label="Add one second">+1s</button></div>
        <div className="match-settings" aria-label="Match point settings"><span>Point match</span><div className="target-control"><button type="button" onClick={() => updateTargetScore(targetScore - 1)} aria-label="Decrease match point">-</button><input aria-label="Match point" inputMode="numeric" max="99" min="1" type="number" value={targetScore} onChange={(event) => updateTargetScore(event.target.value)} /><button type="button" onClick={() => updateTargetScore(targetScore + 1)} aria-label="Increase match point">+</button></div><div className="preset-points" aria-label="Point presets">{[6, 10, 15].map((point) => <button key={point} className={targetScore === point ? 'active' : ''} type="button" onClick={() => updateTargetScore(point)}>{point}</button>)}</div></div>
        <button className="speak-button" type="button" onClick={() => announce(scores, language, winner)}><Icon type={winner ? 'trophy' : 'volume'} />{winner ? buildSpeech(scores, 'ja-JP', winner) : 'Speak score'}</button>
        <div className="last-call"><span>Last call</span><strong>{lastCall}</strong></div>
      </section>
      <section className="scoreboard" aria-label="Scoreboard">{[PLAYERS.server, PLAYERS.receiver].map((player) => <article className={`score-panel ${player.theme}`} key={player.key}><div className="panel-head"><div><p>{player.english}</p><h2>{player.label}</h2></div><span className={leader?.key === player.key ? 'lead active' : 'lead'}>{leader?.key === player.key ? 'Lead' : 'Ready'}</span></div><button className="score-hit" type="button" onClick={() => addPoint(player.key)}>{scores[player.key]}</button><div className="panel-actions"><button type="button" onClick={() => addPoint(player.key)} aria-label={`${player.label} plus one`}><Icon type="plus" /></button></div></article>)}</section>
      <footer className="control-dock"><div className="quick-actions"><button type="button" onClick={undo}><Icon type="undo" />Undo</button><button type="button" onClick={resetMatch}><Icon type="reset" />Reset</button><button type="button" onClick={callAllLanguages}><Icon type="volume" />3 voices</button></div></footer>
    </main>
  )
}

export default App
