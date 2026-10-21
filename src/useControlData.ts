import { useCallback, useEffect, useState } from 'react'
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { auth, db } from './firebase'
import { newestFirst, normalizeFeedback, normalizeStat, type Estado, type Feedback, type Stat } from './data'

function errorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code.includes('permission-denied')) return 'Acceso denegado. Revisa los permisos de lectura y actualización en Firestore.'
  if (code.includes('network') || code.includes('unavailable')) return 'Sin conexión con Firebase. Comprueba tu conexión e inténtalo de nuevo.'
  return error instanceof Error ? error.message : 'No se pudo conectar con Firebase.'
}

export function useControlData() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  const [loading, setLoading] = useState({ feedback: true, stats: true })
  const [errors, setErrors] = useState({ feedback: '', stats: '' })
  const [cached, setCached] = useState({ feedback: true, stats: true })
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    const unsubscribe: (() => void)[] = []
    setLoading({ feedback: true, stats: true })
    setErrors({ feedback: '', stats: '' })
    const start = async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth)
        if (!active) return
        for (const key of ['feedback', 'stats'] as const) {
          // Sin orderBy: Firestore omite documentos antiguos que no tienen fecha.
          unsubscribe.push(onSnapshot(collection(db, key === 'feedback' ? 'feedbacks' : 'estadistica'), { includeMetadataChanges: true }, snapshot => {
            if (!active) return
            if (key === 'feedback') setFeedback(snapshot.docs.map(item => normalizeFeedback(item.id, item.data())).sort(newestFirst))
            else setStats(snapshot.docs.map(item => normalizeStat(item.id, item.data())).sort(newestFirst))
            setLoading(value => ({ ...value, [key]: false }))
            setErrors(value => ({ ...value, [key]: '' }))
            setCached(value => ({ ...value, [key]: snapshot.metadata.fromCache }))
            if (!snapshot.metadata.fromCache) setLastSync(new Date())
          }, error => {
            if (!active) return
            setLoading(value => ({ ...value, [key]: false }))
            setErrors(value => ({ ...value, [key]: errorMessage(error) }))
          }))
        }
      } catch (error) {
        if (!active) return
        const message = errorMessage(error)
        setErrors({ feedback: message, stats: message })
        setLoading({ feedback: false, stats: false })
      }
    }
    void start()
    return () => { active = false; unsubscribe.forEach(stop => stop()) }
  }, [attempt])

  const move = useCallback(async (id: string, estado: Estado) => {
    setSaving(value => new Set(value).add(id))
    setActionError('')
    try {
      // La suscripción refleja la escritura y Firestore revierte si el servidor la rechaza.
      await updateDoc(doc(db, 'feedbacks', id), { estado })
    } catch (error) { setActionError(`No se guardó el estado. ${errorMessage(error)}`) }
    finally { setSaving(value => { const next = new Set(value); next.delete(id); return next }) }
  }, [])
  return { feedback, stats, loading, errors, cached, lastSync, saving, actionError, move, retry: () => setAttempt(value => value + 1) }
}
