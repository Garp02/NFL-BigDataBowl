// Paleta oficial aproximada de cada equipo (abreviaturas del dataset: los Rams son "LA").
export interface ColoresEquipo {
  c1: string // primario
  c2: string // secundario
}

export const COLORES_EQUIPO: Record<string, ColoresEquipo> = {
  ARI: { c1: '#97233F', c2: '#FFB612' },
  ATL: { c1: '#A71930', c2: '#000000' },
  BAL: { c1: '#241773', c2: '#9E7C0C' },
  BUF: { c1: '#00338D', c2: '#C60C30' },
  CAR: { c1: '#0085CA', c2: '#101820' },
  CHI: { c1: '#0B162A', c2: '#C83803' },
  CIN: { c1: '#FB4F14', c2: '#000000' },
  CLE: { c1: '#FF3C00', c2: '#311D00' },
  DAL: { c1: '#003594', c2: '#869397' },
  DEN: { c1: '#FB4F14', c2: '#002244' },
  DET: { c1: '#0076B6', c2: '#B0B7BC' },
  GB: { c1: '#203731', c2: '#FFB612' },
  HOU: { c1: '#03202F', c2: '#A71930' },
  IND: { c1: '#002C5F', c2: '#A2AAAD' },
  JAX: { c1: '#006778', c2: '#D7A22A' },
  KC: { c1: '#E31837', c2: '#FFB81C' },
  LA: { c1: '#003594', c2: '#FFA300' },
  LAC: { c1: '#0080C6', c2: '#FFC20E' },
  LV: { c1: '#000000', c2: '#A5ACAF' },
  MIA: { c1: '#008E97', c2: '#FC4C02' },
  MIN: { c1: '#4F2683', c2: '#FFC62F' },
  NE: { c1: '#002244', c2: '#C60C30' },
  NO: { c1: '#D3BC8D', c2: '#101820' },
  NYG: { c1: '#0B2265', c2: '#A71930' },
  NYJ: { c1: '#125740', c2: '#000000' },
  PHI: { c1: '#004C54', c2: '#A5ACAF' },
  PIT: { c1: '#FFB612', c2: '#101820' },
  SEA: { c1: '#002244', c2: '#69BE28' },
  SF: { c1: '#AA0000', c2: '#B3995D' },
  TB: { c1: '#D50A0A', c2: '#FF7900' },
  TEN: { c1: '#0C2340', c2: '#4B92DB' },
  WAS: { c1: '#5A1414', c2: '#FFB612' },
}

const NEUTRO: ColoresEquipo = { c1: '#013369', c2: '#D50A0A' } // azul y rojo del escudo NFL

export const coloresDe = (equipo: string): ColoresEquipo => COLORES_EQUIPO[equipo] ?? NEUTRO

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

function distancia(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

export function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Color de texto legible sobre un fondo dado. */
export const textoSobre = (fondo: string) => (luminancia(fondo) > 0.6 ? '#101820' : '#FFFFFF')

export interface TemaPizarra {
  equipo: ColoresEquipo // colores del equipo seleccionado (acento de la interfaz)
  ofensiva: string
  defensa: string
  ezOfensiva: string
  ezDefensa: string
}

/**
 * Tema de una jugada: cada bando usa el primario de su equipo. Si los dos primarios se parecen
 * (p. ej. dos azules marino), el bando del equipo no seleccionado cambia a su secundario.
 */
export function temaPizarra(seleccionado: string, ofensiva: string, defensiva: string): TemaPizarra {
  const o = coloresDe(ofensiva)
  const d = coloresDe(defensiva)
  let colorO = o.c1
  let colorD = d.c1
  if (distancia(colorO, colorD) < 90) {
    if (ofensiva === seleccionado) colorD = d.c2
    else colorO = o.c2
  }
  return { equipo: coloresDe(seleccionado), ofensiva: colorO, defensa: colorD, ezOfensiva: colorO, ezDefensa: colorD }
}
