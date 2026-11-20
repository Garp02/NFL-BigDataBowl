export type Confianza = 'alta' | 'media' | 'baja'

export interface Metricas {
  n: number
  confianza: Confianza
  yds_jugada: number | null
  exito_pct: number | null
  comp_pct: number | null
  sack_pct: number | null
  presion_pct: number | null
  blitz_pct: number | null
  man_pct: number | null
  pa_pct: number | null
}

export interface Fila extends Metricas {
  grupo: string
  uso_pct: number
  liga_yds_jugada?: number
  liga_uso_pct?: number
}

export interface Hallazgo { texto: string; n: number; confianza: Confianza }

export interface Reporte {
  equipo: string
  lado: 'ofensiva' | 'defensa'
  juegos: number
  resumen: Metricas
  liga: Metricas
  etiquetas: Record<string, string>
  desgloses: Record<string, Fila[]>
  hallazgos: Hallazgo[]
  nota: string
}

export interface Bloqueador {
  nfl_id: number
  jugador: string
  posicion: string
  snaps: number
  presiones_permitidas: number
  sacks: number
  golpes: number
  hurries: number
  superado: number
  presion_pct: number
  presion_suav_pct: number
  confianza: Confianza
  eslabon_debil: boolean
}

export interface Rusher {
  nfl_id: number
  jugador: string
  equipo: string
  posicion: string
  snaps: number
  presiones: number
  sacks: number
  golpes: number
  hurries: number
  presion_pct: number
  presion_suav_pct: number
  confianza: Confianza
}

export interface Lineas {
  equipo: string
  proteccion: { liga_presion_pct: number; k_suavizado: number; jugadores: Bloqueador[] }
  pass_rush: { liga_presion_pct: number; k_suavizado: number; jugadores: Rusher[] }
}

export interface Lideres {
  liga_presion_pct: number
  k_suavizado: number
  min_snaps: number
  jugadores: Rusher[]
}
