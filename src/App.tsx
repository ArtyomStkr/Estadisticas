import { useEffect, useRef, useState, type RefObject } from 'react'
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { auth, db } from './firebase'
import './App.css'

type Estado = 'pendiente' | 'en proceso' | 'completado'
type Categoria = 'error' | 'sugerencia' | 'otro'
type Feedback = { id: string; alias?: string; comentario?: string; estado?: Estado; tipo?: string; marca?: string; modelo?: string; sdkAndroid?: number; versionAndroid?: string; versionApp?: string; fecha: Date }
type Stat = { id: string; perfil: string; perfilEtiqueta: string; conoceTerminos: boolean; versionApp: string; fecha: Date }
type Column = { estado: Estado; label: string; color: string }

const columns: Column[] = [
  { estado: 'pendiente', label: 'Pendiente', color: 'amber' },
  { estado: 'en proceso', label: 'En proceso', color: 'blue' },
  { estado: 'completado', label: 'Completado', color: 'green' },
]
const formatDate = (date: Date) => new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
const toDate = (value: unknown) => value && typeof value === 'object' && 'toDate' in value ? (value as { toDate: () => Date }).toDate() : new Date()
const getCategory = (tipo?: string): Categoria => {
  const normalized = (tipo || '').trim().toLowerCase()
  if (normalized.includes('bug') || normalized.includes('error')) return 'error'
  if (normalized.includes('mejora') || normalized.includes('sugerencia')) return 'sugerencia'
  return 'otro'
}
const categoryLabel = (tipo?: string) => getCategory(tipo) === 'error' ? 'Error' : getCategory(tipo) === 'sugerencia' ? 'Sugerencia' : 'Otro'
const priority = (tipo?: string) => getCategory(tipo) === 'error' ? 0 : getCategory(tipo) === 'sugerencia' ? 1 : 2

function App() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  const [tab, setTab] = useState<'feedback' | 'estadisticas'>('feedback')
  const [filter, setFilter] = useState<Categoria | 'todos'>('todos')
  const [search, setSearch] = useState('')
  const [dark, setDark] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragged, setDragged] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<Estado, boolean>>({ pendiente: false, 'en proceso': false, completado: false })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth)
        const [feedbackSnapshot, statsSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'feedbacks'), orderBy('fecha', 'desc'))),
          getDocs(query(collection(db, 'estadistica'), orderBy('fecha', 'desc'))),
        ])
        setFeedback(feedbackSnapshot.docs.map((item) => ({ id: item.id, ...item.data(), fecha: toDate(item.data().fecha) })) as Feedback[])
        setStats(statsSnapshot.docs.map((item) => ({ id: item.id, ...item.data(), fecha: toDate(item.data().fecha) })) as Stat[])
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo conectar con Firebase.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const draw = () => {
      const ratio = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      canvas.width = width * ratio
      canvas.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      const labels = ['Estudiante', 'Operador', 'Importador', 'Otro']
      const values = labels.map((label) => stats.filter((item) => item.perfilEtiqueta === label).length)
      const max = Math.max(...values, 1)
      const slot = (width - 40) / labels.length
      const barWidth = Math.min(52, slot - 20)
      context.strokeStyle = dark ? '#293644' : '#e4e9e4'
      for (let y = 24; y < height - 27; y += 38) { context.beginPath(); context.moveTo(8, y); context.lineTo(width - 8, y); context.stroke() }
      values.forEach((value, index) => {
        const x = 20 + index * slot + (slot - barWidth) / 2
        const barHeight = value / max * (height - 80)
        const y = height - 37 - barHeight
        context.fillStyle = ['#f2b765', '#70a7ff', '#f07868', '#5ed6ad'][index]
        context.beginPath(); context.roundRect(x, y, barWidth, barHeight, 6); context.fill()
        context.fillStyle = dark ? '#edf2f7' : '#26342e'; context.font = '600 12px Manrope'; context.textAlign = 'center'; context.fillText(String(value), x + barWidth / 2, y - 9)
        context.fillStyle = dark ? '#8e9baa' : '#718078'; context.font = '11px Manrope'; context.fillText(labels[index], x + barWidth / 2, height - 13)
      })
    }
    draw(); window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [stats, dark])

  const move = async (id: string, estado: Estado) => {
    setFeedback((items) => items.map((item) => item.id === id ? { ...item, estado } : item))
    try { await updateDoc(doc(db, 'feedbacks', id), { estado }) } catch { setError('El estado cambió solo localmente. Revisa las reglas de Firestore.') }
  }
  const visible = feedback
    .filter((item) => (filter === 'todos' || getCategory(item.tipo) === filter) && `${item.alias} ${item.comentario} ${item.modelo}`.toLowerCase().includes(search.toLowerCase()))
  const counts = columns.map(({ estado }) => feedback.filter((item) => (item.estado ?? 'pendiente') === estado).length)
  const profileCounts = ['estudiante', 'operador', 'importador', 'otro'].map((profile) => stats.filter((item) => item.perfil === profile).length)
  const topProfile = ['Estudiantes', 'Operadores', 'Importadores', 'Otros'][profileCounts.indexOf(Math.max(...profileCounts))] || 'Sin datos'

  return <div className={`app ${dark ? 'dark' : 'light'}`}>
    <header className="topbar"><a className="brand" href="/webdeestadisticas/"><span>AB</span><strong>ARANCEL BOLIVIA <i>2026 no oficial</i></strong></a><nav><button className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}>Feedback <b>{feedback.length}</b></button><button className={tab === 'estadisticas' ? 'active' : ''} onClick={() => setTab('estadisticas')}>Estadísticas</button></nav><div className="top-tools"><span className={`connection ${loading ? '' : error ? 'bad' : 'good'}`}><i />{loading ? 'Conectando' : error ? 'Revisar conexión' : 'Firebase activo'}</span><button className="theme-toggle" onClick={() => setDark((value) => !value)} aria-label="Cambiar tema">{dark ? '☼' : '☾'}</button><span className="avatar">AP</span></div></header>
    <main><div className="page-title"><div><span className="overline">ARANCEL BOLIVIA / {tab === 'feedback' ? 'FEEDBACK' : 'ESTADÍSTICAS'}</span><h1>{tab === 'feedback' ? 'Reportes y solicitudes' : 'Uso de la aplicación'}</h1></div><span className="date-label">11 SEP 2026</span></div>{error && <div className="error-banner">{error}</div>}{tab === 'feedback' ? <FeedbackBoard feedback={visible} counts={counts} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} dragged={dragged} setDragged={setDragged} move={move} loading={loading} expanded={expanded} setExpanded={setExpanded} /> : <Stats stats={stats} profileCounts={profileCounts} topProfile={topProfile} canvasRef={canvasRef} />}</main>
  </div>
}

function FeedbackBoard({ feedback, counts, filter, setFilter, search, setSearch, dragged, setDragged, move, loading, expanded, setExpanded }: { feedback: Feedback[]; counts: number[]; filter: Categoria | 'todos'; setFilter: (value: Categoria | 'todos') => void; search: string; setSearch: (value: string) => void; dragged: string | null; setDragged: (value: string | null) => void; move: (id: string, estado: Estado) => Promise<void>; loading: boolean; expanded: Record<Estado, boolean>; setExpanded: (value: (current: Record<Estado, boolean>) => Record<Estado, boolean>) => void }) {
  return <><section className="metrics"><Metric label="Recibidos" value={feedback.length} /><Metric label="Pendientes" value={counts[0]} color="amber" /><Metric label="En proceso" value={counts[1]} color="blue" /><Metric label="Completados" value={counts[2]} color="green" /></section><div className="board-tools"><div className="filters"><button className={filter === 'todos' ? 'selected' : ''} onClick={() => setFilter('todos')}>Todos</button><button className={filter === 'error' ? 'selected error-filter' : ''} onClick={() => setFilter('error')}>Errores</button><button className={filter === 'sugerencia' ? 'selected suggestion-filter' : ''} onClick={() => setFilter('sugerencia')}>Sugerencias</button><button className={filter === 'otro' ? 'selected other-filter' : ''} onClick={() => setFilter('otro')}>Otros</button></div><label className="search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alias, modelo o reporte" /></label></div><section className="board">{columns.map((column) => { const columnItems = feedback.filter((item) => (item.estado ?? 'pendiente') === column.estado).sort((first, second) => column.estado === 'pendiente' ? priority(first.tipo) - priority(second.tipo) || second.fecha.getTime() - first.fecha.getTime() : second.fecha.getTime() - first.fecha.getTime()); const shownItems = expanded[column.estado] ? columnItems : columnItems.slice(0, 5); return <div className="column" key={column.estado} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged) void move(dragged, column.estado); setDragged(null) }}><div className="column-title"><span className={`dot ${column.color}`} /><h2>{column.label}</h2><b>{columnItems.length}</b></div><div className="card-list">{loading ? <p className="empty">Cargando Firebase...</p> : shownItems.map((item) => <FeedbackCard item={item} key={item.id} setDragged={setDragged} />)}</div>{columnItems.length > 5 && <button className="show-more" onClick={() => setExpanded((current) => ({ ...current, [column.estado]: !current[column.estado] }))}>{expanded[column.estado] ? 'Mostrar menos' : `Mostrar más (${columnItems.length - 5})`}</button>}</div> })}</section></>
}

function FeedbackCard({ item, setDragged }: { item: Feedback; setDragged: (value: string | null) => void }) { const initials = (item.alias || 'Usuario').split(' ').map((part) => part[0]).slice(0, 2).join(''); const type = getCategory(item.tipo); return <article className="feedback-card" draggable onDragStart={() => setDragged(item.id)}><div className="card-header"><span className={`kind ${type}`}>{categoryLabel(item.tipo)}</span><time>{formatDate(item.fecha)}</time></div><h3>{item.comentario || 'Sin descripción'}</h3><div className="reporter"><span>{initials}</span><strong>{item.alias || 'Anónimo'}</strong></div><div className="device-grid"><span><small>DISPOSITIVO</small>{item.marca || 'No indicado'} · {item.modelo || 'No indicado'}</span><span><small>ANDROID</small>{item.versionAndroid || 'No indicado'} {item.sdkAndroid ? `(SDK ${item.sdkAndroid})` : ''}</span><span><small>VERSIÓN APP</small>{item.versionApp || 'No indicada'}</span></div></article> }
function Metric({ label, value, color = '' }: { label: string; value: number; color?: string }) { return <div className="metric"><span className={`metric-mark ${color}`} /><div><small>{label}</small><strong>{value}</strong></div></div> }
function Stats({ stats, profileCounts, topProfile, canvasRef }: { stats: Stat[]; profileCounts: number[]; topProfile: string; canvasRef: RefObject<HTMLCanvasElement | null> }) { const known = Math.round(stats.filter((item) => item.conoceTerminos).length / Math.max(stats.length, 1) * 100); return <><section className="stats-intro"><div><span className="overline">SEÑAL DE USO · CUESTIONARIO INICIAL</span><h2>Entender quién usa<br /><em>la aplicación.</em></h2><p>Una lectura simple de los perfiles que están incorporándose a Arancel Bolivia 2026.</p></div><strong>{stats.length}<small>respuestas</small></strong></section><section className="stats-grid"><div className="panel"><div className="panel-title"><span><small>PERFILES</small><h2>Distribución</h2></span><b>últimas respuestas</b></div><canvas ref={canvasRef} /></div><div className="panel ranking"><span className="panel-kicker">RANKING DE ADOPCIÓN</span><h2>{topProfile}</h2><p>Es el perfil con más respuestas registradas.</p>{['Estudiantes', 'Operadores', 'Importadores', 'Otros'].map((label, index) => <div className="rank" key={label}><span>{label}</span><div><i style={{ width: `${Math.max(profileCounts[index] / Math.max(...profileCounts, 1) * 100, 3)}%` }} /></div><b>{profileCounts[index]}</b></div>)}</div></section><section className="insights"><div><strong>{known}%</strong><span>conocía los términos aduaneros</span></div><div><strong>{new Set(stats.map((item) => item.versionApp)).size}</strong><span>versiones activas</span></div><div><strong>{stats.length}</strong><span>respuestas registradas</span></div></section></> }
export default App