import type { ReactNode } from 'react'
import type { Confianza } from '../types'

const colores: Record<Confianza, string> = {
  alta: 'bg-green-100 text-green-800',
  media: 'bg-yellow-100 text-yellow-800',
  baja: 'bg-red-100 text-red-800',
}

export function Confiabilidad({ nivel }: { nivel: Confianza }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colores[nivel]}`} title="Confianza según el tamaño de la muestra (n)">
      {nivel === 'baja' ? 'n bajo' : nivel}
    </span>
  )
}

export function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{titulo}</h2>
      {children}
    </section>
  )
}

export function Kpi({ etiqueta, valor, liga, unidad = '', mejorSiAlto = true }: {
  etiqueta: string
  valor: number | null
  liga: number | null
  unidad?: string
  mejorSiAlto?: boolean | null
}) {
  const dif = valor !== null && liga !== null ? valor - liga : null
  let color = 'text-gray-500'
  if (dif !== null && mejorSiAlto !== null && Math.abs(dif) > 0.0001) color = (dif > 0) === mejorSiAlto ? 'text-green-700' : 'text-red-700'
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{etiqueta}</div>
      <div className="text-2xl font-bold text-gray-900">{valor === null ? '—' : `${valor}${unidad}`}</div>
      <div className={`text-xs ${color}`}>
        liga {liga ?? '—'}{unidad}{dif !== null && ` (${dif > 0 ? '+' : ''}${dif.toFixed(1)})`}
      </div>
    </div>
  )
}

export function Estado({ cargando, error }: { cargando: boolean; error: string | null }) {
  if (error) return <p className="rounded bg-red-50 p-3 text-red-700">{error}</p>
  if (cargando) return <p className="text-gray-500">Cargando…</p>
  return null
}
