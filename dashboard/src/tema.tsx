import { createContext, useContext } from 'react'
import { coloresDe, luminancia } from './teamColors'

// Tema de la interfaz según el equipo seleccionado
export interface Tema {
  c1: string // primario del equipo
  c2: string // secundario
  acento: string // color legible sobre fondo blanco (gráficas, pestaña activa, botones)
  alerta: string // color para "eslabón débil"; evita confundirse si el acento es rojo
}

const ALERTA = '#B91C1C'

export function temaDe(equipo: string): Tema {
  const { c1, c2 } = coloresDe(equipo)
  // Un primario muy claro (PIT, NO) no se lee sobre blanco: se usa el secundario
  const acento = luminancia(c1) > 0.65 && luminancia(c2) < luminancia(c1) ? c2 : c1
  const [r1, g1, b1] = [1, 3, 5].map((i) => parseInt(acento.slice(i, i + 2), 16))
  const rojizo = Math.hypot(r1 - 0xb9, g1 - 0x1c, b1 - 0x1c) < 120
  return { c1, c2, acento, alerta: rojizo ? '#111827' : ALERTA }
}

export const TemaContext = createContext<Tema>(temaDe(''))
export const useTema = () => useContext(TemaContext)
