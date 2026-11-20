import { useEffect, useState } from 'react'

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Ruta relativa SIN diagonal inicial: la app se publica en una subruta.
// Reintenta ante fallos de red o 5xx (p. ej. el backend reiniciándose con --reload); un 4xx no se reintenta.
export async function getJson<T>(ruta: string, intentos = 5): Promise<T> {
  for (let n = 1; ; n++) {
    let fallo: Error
    let reintentable = true
    try {
      const r = await fetch(`api/${ruta}`)
      if (r.ok) return (await r.json()) as T
      fallo = new Error(`Error ${r.status} al pedir ${ruta}`)
      reintentable = r.status >= 500
    } catch (e) {
      fallo = e instanceof Error ? e : new Error(String(e))
    }
    if (!reintentable || n >= intentos) throw fallo
    await pausa(700 * n)
  }
}

export async function postJson<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(`api/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  if (!r.ok) {
    const detalle = await r.json().then((j: { detail?: unknown }) => j.detail).catch(() => null)
    throw new Error(typeof detalle === 'string' ? detalle : `Error ${r.status}`)
  }
  return r.json() as Promise<T>
}

export function useApi<T>(ruta: string | null) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!ruta) {
      setCargando(false)
      return
    }
    let vigente = true
    setCargando(true)
    setError(null)
    getJson<T>(ruta)
      .then((d) => vigente && setDatos(d))
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false))
    return () => { vigente = false }
  }, [ruta])

  return { datos, error, cargando }
}
