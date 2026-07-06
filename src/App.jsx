import { useEffect, useMemo, useState } from 'react'
import './App.css'
import './scoreboard-updates.css'

const LANGUAGES = [
  { code: 'ja-JP', label: '日本語' },
  { code: 'en-US', label: 'English' },
  { code: 'zh-CN', label: '中文' },
]
const VOICE_STYLES = [
  { key: 'female', label: '女性' },
  { key: 'male', label: '男性' },
  { key: 'high', label: '高い' },
  { key: 'low', label: '低い' },
  { key: 'announcer', label: 'アナウンサー' },
]
const DEFAULT_VOICE_STYLES = { 'ja-JP': 'female', 'en-US': 'announcer', 'zh-CN': 'female' }
const PLAYERS = {
  server: { key: 'server', label: 'サーバー', english: 'Server', theme: 'blue' },
  receiver: { key: 'receiver', label: 'レシーバー', english: 'Receiver', theme: 'red' },
}

function formatClock(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
function getLead(scores) { if (scores.server === scores.receiver) return null; return scores.server > scores.receiver ? PLAYERS.server : PLAYERS.receiver }
function isGameOver(scores, targetScore) { return Math.max(scores.server, scores.receiver) >= targetScore && Math.abs(scores.server - scores.receiver) >= 2 }
function buildScoreCall(scores, language) { if (language === 'ja-JP') return `${scores.server}対${scores.receiver}`; if (language === 'zh-CN') return scores.server === scores.receiver ? `${scores.server}平${scores.receiver}` : `${scores.server}比${scores.receiver}`; return `${scores.server} to ${scores.receiver}` }
function englishNumber(value) { return ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'][value] || String(value) }
function buildSpeech(scores, language, winner = null) { if (winner) { if (language === 'ja-JP') return `ゲーム${winner.label}`; if (language === 'zh-CN') return winner.key === 'server' ? '发球方获胜' : '接球方获胜'; return `Game ${winner.english}` } return buildScoreCall(scores, language) }
function buildSpokenSpeech(scores, language, winner = null) { if (winner) return buildSpeech(scores, language, winner); if (language === 'en-US') return `Score. ${englishNumber(scores.server)} to ${englishNumber(scores.receiver)}.`; return buildSpeech(scores, language) }
function getVoiceSettings(style) { return ({ female: { rate: 0.9, pitch: 1.08 }, male: { rate: 0.86, pitch: 0.88 }, high: { rate: 0.9, pitch: 1.28 }, low: { rate: 0.82, pitch: 0.72 }, announcer: { rate: 0.74, pitch: 0.86 } })[style] || { rate: 0.9, pitch: 1.08 } }
function preferredVoiceNames(language, style) {
  const lists = {
    'ja-JP': { female: ['Kyoko','Google 日本語','Microsoft Nanami','Microsoft Haruka'], male: ['Otoya','Microsoft Ichiro'], high: ['Kyoko','Google 日本語','Microsoft Nanami'], low: ['Otoya','Microsoft Ichiro'], announcer: ['Otoya','Kyoko','Google 日本語'] },
    'en-US': { female: ['Samantha','Karen','Moira','Microsoft Jenny','Microsoft Aria'], male: ['Daniel','Alex','Microsoft Guy','Microsoft David','Google UK English Male'], high: ['Samantha','Karen','Microsoft Jenny'], low: ['Daniel','Alex','Microsoft Guy','Microsoft David'], announcer: ['Daniel','Google UK English Male','Microsoft Guy','Alex','Google US English'] },
    'zh-CN': { female: ['Tingting','Meijia','Sin-ji','Microsoft Xiaoxiao','Google 普通话'], male: ['Microsoft Yunxi','Microsoft Kangkang','Microsoft Yunyang'], high: ['Tingting','Microsoft Xiaoxiao'], low: ['Microsoft Yunxi','Microsoft Kangkang'], announcer: ['Microsoft Yunyang','Microsoft Yunxi','Tingting','Google 普通话'] },
  }
  return lists[language]?.[style] || []
}
function chooseVoice(language, style) { const voices = window.speechSynthesis.getVoices(); if (!voices.length) return null; const prefix = language.slice(0, 2); const named = preferredVoiceNames(language, style).map((name) => voices.find((voice) => voice.lang.startsWith(prefix) && voice.name.includes(name))).find(Boolean); return named || voices.find((voice) => voice.lang === language) || voices.find((voice) => voice.lang.startsWith(prefix)) || null }
function speak(text, language, style = DEFAULT_VOICE_STYLES[language]) { if (!('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); const settings = getVoiceSettings(style); utterance.lang = language; utterance.voice = chooseVoice(language, style); utterance.rate = settings.rate; utterance.pitch = settings.pitch; window.__charlieLastSpeech = { language, pitch: utterance.pitch, rate: utterance.rate, style, text, voice: utterance.voice?.name || null }; window.speechSynthesis.speak(utterance) }
function Icon({ type }) { const paths = { plus: 'M12 5v14M5 12h14', undo: 'M9 7H4v5m.5-.5A8 8 0 1 0 7 5.7', reset: 'M4 4v6h6M20 20v-6h-6M5 14a7 7 0 0 0 12 4M19 10A7 7 0 0 0 7 6', volume: 'M4 10v4h4l5 4V6L8 10H4Zm12-2a5 5 0 0 1 0 8m2.5-10.5a8 8 0 0 1 0 13', trophy: 'M8 4h8v3a4 4 0 0 1-8 0V4Zm0 1H5v2a3 3 0 0 0 3 3m8-5h3v2a3 3 0 0 1-3 3m-4 3v4m-3 0h6m-8 3h10' }; return <svg aria-hidden="true" className="icon" viewBox="0 0 24 24"><path d={paths[type]} /></svg> }

function App() {
  const [scores, setScores] = useState({ server: 0, receiver: 0 })
  const [actionStack, setActionStack] = useState([])
  const [language, setLanguage] = useState('ja-JP')
  const [clock, setClock] = useState(222)
  const [lastCall, setLastCall] = useState('Ready')
  const [targetScore, setTargetScore] = useState(10)
  const [theme, setTheme] = useState(() => localStorage.getItem('charlie-theme') || 'light')
  const [voiceStyles, setVoiceStyles] = useState(() => { const saved = localStorage.getItem('charlie-voice-styles'); return saved ? { ...DEFAULT_VOICE_STYLES, ...JSON.parse(saved) } : DEFAULT_VOICE_STYLES })
  const winner = useMemo(() => (isGameOver(scores, targetScore) ? getLead(scores) : null), [scores, targetScore])
  const leader = useMemo(() => getLead(scores), [scores])
  const selectedVoiceStyle = voiceStyles[language] || DEFAULT_VOICE_STYLES[language]

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('charlie-theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('charlie-voice-styles', JSON.stringify(voiceStyles)) }, [voiceStyles])
  function announce(nextScores, nextLanguage = language, nextWinner = null) { const text = buildSpeech(nextScores, nextLanguage, nextWinner); setLastCall(text); speak(buildSpokenSpeech(nextScores, nextLanguage, nextWinner), nextLanguage, voiceStyles[nextLanguage]) }
  function addPoint(playerKey) { if (winner) return; setScores((current) => { const next = { ...current, [playerKey]: current[playerKey] + 1 }; const nextWinner = isGameOver(next, targetScore) ? getLead(next) : null; setActionStack((items) => [{ id: crypto.randomUUID(), delta: 1, player: playerKey }, ...items].slice(0, 20)); announce(next, language, nextWinner); return next }) }
  function resetMatch() { const next = { server: 0, receiver: 0 }; setScores(next); setActionStack([]); setClock(0); setLastCall('New match'); speak(language === 'ja-JP' ? '新しい試合です' : language === 'zh-CN' ? '新比赛开始' : 'New match', language, selectedVoiceStyle) }
  function updateTargetScore(value) { const nextValue = Math.min(99, Math.max(1, Number(value) || 1)); setTargetScore(nextValue); setLastCall(`${nextValue} point match`) }
  function undo() { const last = actionStack[0]; if (!last) return; setScores((current) => { const next = { ...current, [last.player]: Math.max(0, current[last.player] - last.delta) }; setActionStack((items) => items.slice(1)); announce(next); return next }) }
  function callAllLanguages() { LANGUAGES.forEach((item, index) => window.setTimeout(() => speak(buildSpokenSpeech(scores, item.code, winner), item.code, voiceStyles[item.code]), index * 1800)); setLastCall('JA / EN / ZH') }
  function updateVoiceStyle(style) { setVoiceStyles((current) => ({ ...current, [language]: style })) }

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">C</span><div><h1>Charlie Scoreboard</h1><p>日本語 / English / 中文</p></div></div><div className="top-controls"><div className="theme-switcher" aria-label="Color theme">{['light', 'dark'].map((item) => <button key={item} className={theme === item ? 'selected' : ''} type="button" onClick={() => setTheme(item)}>{item === 'light' ? 'Light' : 'Dark'}</button>)}</div><div className="language-switcher" aria-label="Voice language">{LANGUAGES.map((item) => <button key={item.code} className={language === item.code ? 'selected' : ''} type="button" onClick={() => setLanguage(item.code)}>{item.label}</button>)}</div><div className="voice-switcher" aria-label={`${language} voice style`}>{VOICE_STYLES.map((item) => <button key={item.key} className={selectedVoiceStyle === item.key ? 'selected' : ''} type="button" onClick={() => updateVoiceStyle(item.key)}>{item.label}</button>)}</div></div></header>
      <section className="status-strip"><div className="timer"><span>Match</span><strong>{formatClock(clock)}</strong><button type="button" onClick={() => setClock((value) => value + 1)} aria-label="Add one second">+1s</button></div><div className="match-settings" aria-label="Match point settings"><span>Point match</span><div className="target-control"><button type="button" onClick={() => updateTargetScore(targetScore - 1)} aria-label="Decrease match point">-</button><input aria-label="Match point" inputMode="numeric" max="99" min="1" type="number" value={targetScore} onChange={(event) => updateTargetScore(event.target.value)} /><button type="button" onClick={() => updateTargetScore(targetScore + 1)} aria-label="Increase match point">+</button></div><div className="preset-points" aria-label="Point presets">{[6, 10, 15].map((point) => <button key={point} className={targetScore === point ? 'active' : ''} type="button" onClick={() => updateTargetScore(point)}>{point}</button>)}</div></div><button className="speak-button" type="button" onClick={() => announce(scores, language, winner)}><Icon type={winner ? 'trophy' : 'volume'} />{winner ? buildSpeech(scores, 'ja-JP', winner) : 'Speak score'}</button><div className="last-call"><span>Last call</span><strong>{lastCall}</strong></div></section>
      <section className="scoreboard" aria-label="Scoreboard">{[PLAYERS.server, PLAYERS.receiver].map((player) => <article className={`score-panel ${player.theme}`} key={player.key}><div className="panel-head"><div><p>{player.english}</p><h2>{player.label}</h2></div><span className={leader?.key === player.key ? 'lead active' : 'lead'}>{leader?.key === player.key ? 'Lead' : 'Ready'}</span></div><button className="score-hit" type="button" onClick={() => addPoint(player.key)}>{scores[player.key]}</button><div className="panel-actions"><button type="button" onClick={() => addPoint(player.key)} aria-label={`${player.label} plus one`}><Icon type="plus" /></button></div></article>)}</section>
      <footer className="control-dock"><div className="quick-actions"><button type="button" onClick={undo}><Icon type="undo" />Undo</button><button type="button" onClick={resetMatch}><Icon type="reset" />Reset</button><button type="button" onClick={callAllLanguages}><Icon type="volume" />3 voices</button></div></footer>
    </main>
  )
}

export default App
