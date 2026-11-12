import { useEffect, useMemo, useRef, useState } from 'react'
import { requestEcho, requestCompare, EMOTION_HUES } from './echo'
import { downloadCard } from './exportCard'

const STORE_KEY = 'heart-capsule:data'
const SETTINGS_KEY = 'heart-capsule:settings'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function fmtDate(ts) {
  const d = new Date(ts)
  return d.getMonth() + 1 + '月' + d.getDate() + '日 · 周' + WEEKDAYS[d.getDay()]
}

function fmtClock(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return p(d.getHours()) + ':' + p(d.getMinutes())
}

function daysUntil(ts) {
  return Math.max(0, Math.ceil((ts - Date.now()) / 86400000))
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function hashPos(id) {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0
  return { x: 10 + (h % 78), y: 14 + ((h >>> 7) % 62) }
}

function loadStore() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORE_KEY))
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function loadSettings() {
  try {
    return { demo: true, baseURL: '', apiKey: '', model: '', ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }
  } catch {
    return { demo: true, baseURL: '', apiKey: '', model: '' }
  }
}

function LockIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

/* 发光胶囊 */
function Orb({ hue, shape = 'orb', size = 64, float = true, style = {} }) {
  const cls = 'orb orb-' + shape + (float ? ' orb-float' : '')
  const shapeStyle =
    shape === 'pill'
      ? { width: size * 0.72, height: size * 1.12 }
      : { width: size, height: size }
  return (
    <span
      className={cls}
      style={{
        ...shapeStyle,
        background:
          'radial-gradient(circle at 31% 27%, rgba(255,255,255,.95) 0%, hsla(' + hue + ',88%,74%,.95) 26%, hsla(' + hue + ',76%,52%,.95) 62%, hsla(' + hue + ',82%,30%,.98) 100%)',
        boxShadow:
          '0 0 ' + size * 0.5 + 'px hsla(' + hue + ',92%,62%,.42), 0 0 ' + size * 0.18 + 'px hsla(' + hue + ',95%,72%,.55), inset 0 -' + size * 0.1 + 'px ' + size * 0.24 + 'px hsla(' + hue + ',90%,18%,.55)',
        ...style
      }}
    />
  )
}

/* 逐字浮现的回响 */
function Typed({ text, speed = 34, onDone }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (!text) return
    const t = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(t)
          onDone && onDone()
          return v
        }
        return v + 1
      })
    }, speed)
    return () => clearInterval(t)
  }, [text])
  const done = n >= text.length
  return (
    <p className={'typed' + (done ? '' : ' typed-live')}>
      {text.slice(0, n)}
      {!done && <span className="caret" />}
    </p>
  )
}

function Modal({ onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' modal-wide' : '')}>{children}</div>
    </div>
  )
}

/* 情绪星图 */
function StarMap({ capsules, onOpen }) {
  const sorted = useMemo(() => [...capsules].sort((a, b) => a.createdAt - b.createdAt), [capsules])
  const points = sorted.map((c) => {
    const p = hashPos(c.id)
    return { ...c, x: p.x, y: p.y }
  })
  const poly = points.map((c) => (c.x + 3) + ',' + (c.y + 3)).join(' ')
  return (
    <div className="starmap">
      <svg className="starmap-lines" viewBox="0 0 100 90" preserveAspectRatio="none">
        <polyline points={poly} fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="0.35" strokeDasharray="1 1.6" />
      </svg>
      {points.map((c) => (
        <button key={c.id} className="star" style={{ left: c.x + '%', top: c.y + '%' }} onClick={() => onOpen(c.id)}>
          <Orb hue={EMOTION_HUES[c.emotion]} shape={c.shape} size={24 + c.intensity * 7} float={false} />
          <span className="star-tip">{fmtDate(c.createdAt)} · {c.emotion}{c.openDate && c.openDate > Date.now() ? ' · 未开启' : ''}</span>
        </button>
      ))}
      {capsules.length < 3 && <p className="starmap-hint">再多写几颗,星轨连起来会更好看。</p>}
    </div>
  )
}

export default function App() {
  const [capsules, setCapsules] = useState(loadStore)
  const [settings, setSettings] = useState(loadSettings)
  const [draft, setDraft] = useState('')
  const [stage, setStage] = useState('idle') // idle | forming | replied | error
  const [errorMsg, setErrorMsg] = useState('')
  const [current, setCurrent] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [lastSavedId, setLastSavedId] = useState(null)
  const [skyView, setSkyView] = useState('list') // list | map
  const [sealFuture, setSealFuture] = useState(false)
  const [openDate, setOpenDate] = useState('')
  const taRef = useRef(null)

  const save = (next) => {
    setCapsules(next)
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
  }

  const openCapsule = useMemo(() => capsules.find((c) => c.id === openId) || null, [capsules, openId])

  function updateCap(id, patch) {
    save(capsules.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function deleteCap(id) {
    if (window.confirm('确定删除这颗胶囊吗?无法撤销。')) {
      save(capsules.filter((c) => c.id !== id))
      setOpenId(null)
    }
  }

  async function seal() {
    const text = draft.trim()
    if (!text || stage === 'forming') return
    if (sealFuture && !openDate) return
    setStage('forming')
    try {
      const echo = await requestEcho(text, settings)
      const cap = {
        id: uid(),
        text,
        createdAt: Date.now(),
        ...echo,
        openDate: sealFuture && openDate ? new Date(openDate + 'T23:59:59').getTime() : null
      }
      save([cap, ...capsules])
      setLastSavedId(cap.id)
      setCurrent(cap)
      setStage('replied')
      setDraft('')
      setSealFuture(false)
      setOpenDate('')
    } catch (e) {
      setErrorMsg(e.message || '出了点差错')
      setStage('error')
    }
  }

  function reset() {
    setStage('idle')
    setCurrent(null)
    setTimeout(() => taRef.current && taRef.current.focus(), 50)
  }

  function clearAll() {
    if (window.confirm('确定清空所有胶囊吗?这个动作无法撤销。')) {
      save([])
      setOpenId(null)
    }
  }

  const tomorrow = useMemo(() => {
    const d = new Date(Date.now() + 86400000)
    return d.toISOString().slice(0, 10)
  }, [])

  return (
    <div className="page">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="stars" />

      <header className="topbar">
        <div className="brand">
          <Orb hue={268} size={22} float={false} />
          <span className="brand-name">心事胶囊</span>
        </div>
        <button className="icon-btn" title="设置" onClick={() => setSettingsOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      <main className="main">
        {stage === 'idle' && (
          <section className="write-wrap">
            <h1 className="hero-title">今晚,把心事说给我听</h1>
            <p className="hero-sub">不评判,不敷衍。说完,它会变成一颗属于你的胶囊。</p>
            <div className="glass write-card">
              <textarea
                ref={taRef}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) seal()
                }}
                placeholder="此刻的感受、没说出口的话、一件小事、一个人……什么都行。"
                rows={6}
              />
              <div className="time-opt">
                <label className="field-check">
                  <input type="checkbox" checked={sealFuture} onChange={(e) => setSealFuture(e.target.checked)} />
                  <span>做成时间胶囊 · 选一个日子,到那天才能打开</span>
                </label>
                {sealFuture && (
                  <div className="time-opt-row">
                    <input type="date" className="date-input" min={tomorrow} value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
                    {openDate && (
                      <span className="time-opt-hint">
                        {fmtDate(new Date(openDate + 'T23:59:59').getTime())} 解封
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="write-foot">
                <span className="hint">{draft.length > 0 ? draft.length + ' 字' : '⌘/Ctrl + Enter 快速封存'}</span>
                <button className="btn-primary" disabled={!draft.trim() || (sealFuture && !openDate)} onClick={seal}>
                  {sealFuture ? '封存进未来' : '封存这颗胶囊'}
                </button>
              </div>
            </div>
          </section>
        )}

        {stage === 'forming' && (
          <section className="write-wrap forming-wrap">
            <div className="forming">
              <Orb hue={268} size={84} />
              <p className="forming-text">{sealFuture ? '正在把这颗胶囊寄往未来…' : '正在封装这颗胶囊…'}</p>
              <div className="dots">
                <span /><span /><span />
              </div>
            </div>
          </section>
        )}

        {stage === 'replied' && current && (
          <section className="write-wrap reply-wrap">
            <div className="glass reply-card">
              <div className="reply-head">
                <Orb hue={EMOTION_HUES[current.emotion]} shape={current.shape} size={78} />
                <div className="reply-meta">
                  <span className="emotion-tag" style={{ '--tag-hue': EMOTION_HUES[current.emotion] }}>
                    {current.emotion} · 强度 {current.intensity}
                  </span>
                  <span className="reply-date">
                    {fmtDate(current.createdAt)} {fmtClock(current.createdAt)}
                    {current.openDate ? ' · ' + fmtDate(current.openDate) + ' 解封' : ''}
                  </span>
                </div>
              </div>
              <div className="reply-divider">回响</div>
              <Typed text={current.reply} />
              <div className="reply-actions">
                <button className="btn-primary" onClick={reset}>收进夜空</button>
                <button className="btn-ghost" onClick={() => setOpenId(current.id)}>再看看这颗</button>
              </div>
            </div>
          </section>
        )}

        {stage === 'error' && (
          <section className="write-wrap">
            <div className="glass error-card">
              <p className="error-title">胶囊没能封装成功</p>
              <p className="error-msg">{errorMsg}</p>
              <div className="reply-actions">
                <button className="btn-primary" onClick={reset}>返回重写</button>
                <button className="btn-ghost" onClick={() => setSettingsOpen(true)}>检查 AI 设置</button>
              </div>
            </div>
          </section>
        )}

        <section className="sky">
          <div className="sky-head">
            <div className="sky-head-left">
              <h2>你的夜空</h2>
              <span className="sky-count">{capsules.length > 0 ? capsules.length + ' 颗胶囊' : ''}</span>
            </div>
            {capsules.length > 0 && (
              <div className="sky-toggle">
                <button className={'sky-toggle-btn' + (skyView === 'list' ? ' on' : '')} onClick={() => setSkyView('list')}>时间线</button>
                <button className={'sky-toggle-btn' + (skyView === 'map' ? ' on' : '')} onClick={() => setSkyView('map')}>星图</button>
              </div>
            )}
          </div>
          {capsules.length === 0 ? (
            <p className="sky-empty">还没有胶囊。写下第一颗心事,夜空会从这里亮起来。</p>
          ) : skyView === 'map' ? (
            <StarMap capsules={capsules} onOpen={setOpenId} />
          ) : (
            <div className="sky-grid">
              {capsules.map((c) => {
                const locked = c.openDate && c.openDate > Date.now()
                return (
                  <button key={c.id} className={'sky-item' + (c.id === lastSavedId ? ' sky-item-new' : '') + (locked ? ' sky-item-locked' : '')} onClick={() => setOpenId(c.id)}>
                    <span className="sky-orb-wrap">
                      <Orb hue={EMOTION_HUES[c.emotion]} shape={c.shape} size={54} />
                      {locked && <span className="lock-badge"><LockIcon size={12} /></span>}
                    </span>
                    <span className="sky-date">{fmtDate(c.createdAt)}</span>
                    <span className="sky-emotion" style={{ '--tag-hue': EMOTION_HUES[c.emotion] }}>
                      {locked ? '还剩 ' + daysUntil(c.openDate) + ' 天' : c.emotion}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="foot">
        心事只保存在这台设备的浏览器里,不上传任何服务器。
        <span className="ver">v0.3</span>
      </footer>

      {openCapsule && (
        <Modal onClose={() => setOpenId(null)}>
          <CapsuleDetail
            cap={openCapsule}
            settings={settings}
            onUpdate={updateCap}
            onDelete={deleteCap}
          />
        </Modal>
      )}

      {settingsOpen && (
        <Modal onClose={() => setSettingsOpen(false)} wide>
          <SettingsPanel
            settings={settings}
            onSave={(s) => {
              setSettings(s)
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
              setSettingsOpen(false)
            }}
            onClearAll={clearAll}
          />
        </Modal>
      )}
    </div>
  )
}

function CapsuleDetail({ cap, settings, onUpdate, onDelete }) {
  const hue = EMOTION_HUES[cap.emotion]
  const locked = cap.openDate && cap.openDate > Date.now()
  const needCompare = cap.openDate && !locked && !cap.compareReply
  const [nowText, setNowText] = useState('')
  const [opening, setOpening] = useState(false)
  const [err, setErr] = useState('')

  async function unlock() {
    if (opening) return
    setOpening(true)
    setErr('')
    try {
      const r = await requestCompare(cap.text, cap.reply, nowText.trim(), settings)
      onUpdate(cap.id, { compareReply: r.letter, compareAt: Date.now(), unlockedNote: nowText.trim() })
    } catch (e) {
      setErr(e.message || '解封失败')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="detail">
      <div className="detail-orb">
        <span className="detail-orb-wrap">
          <Orb hue={hue} shape={cap.shape} size={110} />
          {locked && <span className="lock-badge lock-badge-big"><LockIcon size={22} /></span>}
        </span>
      </div>
      <div className="detail-meta">
        <span className="emotion-tag" style={{ '--tag-hue': hue }}>{cap.emotion} · 强度 {cap.intensity}</span>
        <span className="reply-date">{fmtDate(cap.createdAt)} {fmtClock(cap.createdAt)}</span>
      </div>

      {locked ? (
        <>
          <p className="lock-info">
            <LockIcon size={14} /> {fmtDate(cap.openDate)} 解封 · 还剩 {daysUntil(cap.openDate)} 天
          </p>
          <div className="detail-block">
            <div className="reply-divider">内容已密封</div>
            <p className="detail-text blur-text">{cap.text}</p>
            <p className="detail-text blur-text">{cap.reply}</p>
          </div>
        </>
      ) : (
        <>
          <div className="detail-block">
            <div className="reply-divider">当时你写下</div>
            <p className="detail-text">{cap.text}</p>
          </div>
          <div className="detail-block">
            <div className="reply-divider">回响</div>
            <p className="detail-text">{cap.reply}</p>
          </div>
          {needCompare && (
            <div className="unlock-box">
              <div className="reply-divider">时间到,解封</div>
              <p className="unlock-ask">封存的日子到了。现在的你,想对当时的自己说什么?(可留空)</p>
              <textarea
                className="unlock-input"
                rows={3}
                value={nowText}
                onChange={(e) => setNowText(e.target.value)}
                placeholder="现在的感受、这阵子的变化……"
              />
              {err && <p className="error-msg">{err}</p>}
              <div className="reply-actions">
                <button className="btn-primary" onClick={unlock} disabled={opening}>
                  {opening ? '正在写信…' : '解封,收一封对照信'}
                </button>
              </div>
            </div>
          )}
          {cap.compareReply && (
            <div className="detail-block">
              <div className="reply-divider">对照信</div>
              <p className="detail-text compare-letter">{cap.compareReply}</p>
              {cap.unlockedNote && (
                <p className="unlock-note">解封时你说:{cap.unlockedNote}</p>
              )}
            </div>
          )}
        </>
      )}

      <div className="reply-actions">
        <button className="btn-primary" onClick={() => downloadCard(cap, hue)}>导出分享图</button>
        <button className="btn-ghost" onClick={() => onDelete(cap.id)}>删除</button>
      </div>
    </div>
  )
}

function SettingsPanel({ settings, onSave, onClearAll }) {
  const [s, setS] = useState(settings)
  const set = (k) => (e) => setS({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  return (
    <div className="settings">
      <h3 className="settings-title">AI 设置</h3>
      <label className="field-check">
        <input type="checkbox" checked={s.demo} onChange={set('demo')} />
        <span>演示模式(不调用真实 AI,本地生成回响)</span>
      </label>
      {!s.demo && (
        <>
          <p className="settings-note">填入任意 OpenAI 兼容接口(DeepSeek、智谱、OpenAI……),密钥只存在你自己的浏览器。</p>
          <label className="field">
            <span>接口地址 Base URL</span>
            <input value={s.baseURL} onChange={set('baseURL')} placeholder="https://api.deepseek.com/v1" />
          </label>
          <label className="field">
            <span>API Key</span>
            <input value={s.apiKey} onChange={set('apiKey')} type="password" placeholder="sk-…" />
          </label>
          <label className="field">
            <span>模型</span>
            <input value={s.model} onChange={set('model')} placeholder="deepseek-chat / gpt-4o-mini …" />
          </label>
        </>
      )}
      <div className="reply-actions">
        <button className="btn-primary" onClick={() => onSave(s)}>保存</button>
        <button className="btn-danger" onClick={onClearAll}>清空所有胶囊</button>
      </div>
    </div>
  )
}
