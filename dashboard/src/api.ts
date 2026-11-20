import { useEffect, useState } from 'react'

// Ruta relativa SIN diagonal inicial: la app se publica en una subruta
export async function getJson<T>(ruta: string): Promise<T> {
  const r = await fetch(`api/${ruta}`)
  if (!r.ok) throw new Error(`Error ${r.status} al pedir ${ruta}`)
  return r.json() as Promise<T>
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
    if (!ruta) return
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
