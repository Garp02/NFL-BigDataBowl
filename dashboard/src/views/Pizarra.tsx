import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApi } from '../api'
import { Estado } from '../components/ui'
import { luminancia, temaPizarra, textoSobre, type TemaPizarra } from '../teamColors'
import { useTema } from '../tema'
import type { JugadaPizarra, JugadaResumen, JugadorPizarra } from '../types'

const ANCHO = 160 / 3 // ancho del campo en yardas
const ORO = '#FFD100' // color de rutas, como la línea amarilla de primer down
const ROJO_ALERTA = '#FF2D2D'

const EVENTOS: Record<string, string> = {
  ball_snap: 'Snap',
  autoevent_ballsnap: 'Snap',
  line_set: 'Línea lista',
  man_in_motion: 'Hombre en movimiento',
  shift: 'Shift',
  play_action: 'Play action',
  pass_forward: 'Pase lanzado',
  autoevent_passforward: 'Pase lanzado',
  pass_arrived: 'Llega el balón',
  pass_outcome_caught: 'Recepción',
  pass_outcome_incomplete: 'Pase incompleto',
  pass_outcome_interception: 'Intercepción',
  pass_tipped: 'Pase desviado',
  autoevent_passinterrupted: 'Pase interrumpido',
  qb_sack: 'Sack',
  qb_strip_sack: 'Sack con balón suelto',
  run: 'Scramble / carrera',
  tackle: 'Tackle',
  out_of_bounds: 'Fuera de límites',
  touchdown: 'Touchdown',
  first_contact: 'Primer contacto',
  fumble: 'Fumble',
}

const ordinal = (n: number) => `${n}ª`

function etiquetaJugada(j: JugadaResumen) {
  const yds = j.yds === null ? '' : ` ${j.yds > 0 ? '+' : ''}${j.yds} yd`
  const vs = j.lado === 'ofensiva' ? `vs ${j.rival}` : `${j.rival} ataca`
  return `S${j.semana} · ${vs} · ${ordinal(j.down)} y ${j.yardsToGo} · Q${j.quarter} ${j.reloj} · ${j.resultado}${yds}`
}

// ---------- Vista ----------

export default function Pizarra({ equipo }: { equipo: string }) {
  const { datos: lista, error, cargando } = useApi<JugadaResumen[]>(`jugadas/${equipo}`)
  const [lado, setLado] = useState<'todas' | 'ofensiva' | 'defensa'>('todas')
  const [clave, setClave] = useState('')

  // Al cambiar de equipo la lista anterior puede seguir en memoria un instante: se filtra por equipo
  const visibles = useMemo(
    () => (lista ?? []).filter((j) => (j.ofensiva === equipo || j.defensiva === equipo) && (lado === 'todas' || j.lado === lado)),
    [lista, equipo, lado],
  )
  const sel = visibles.find((j) => `${j.gameId}-${j.playId}` === clave) ?? visibles[0]
  const { datos: jugada, error: errorJugada, cargando: cargandoJugada } = useApi<JugadaPizarra>(
    sel ? `jugada/${sel.gameId}/${sel.playId}` : null,
  )
  const listaLista = jugada && sel && jugada.gameId === sel.gameId && jugada.playId === sel.playId

  const { acento } = useTema()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(['todas', 'ofensiva', 'defensa'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLado(l)}
            className="rounded-full px-3 py-1 font-semibold"
            style={lado === l ? { background: acento, color: textoSobre(acento) } : { background: '#E5E7EB', color: '#374151' }}
          >
            {l === 'todas' ? 'Todas' : l === 'ofensiva' ? 'Ataque' : 'Defensa'}
          </button>
        ))}
        <select
          value={sel ? `${sel.gameId}-${sel.playId}` : ''}
          onChange={(e) => setClave(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          aria-label="Jugada"
        >
          {visibles.map((j) => (
            <option key={`${j.gameId}-${j.playId}`} value={`${j.gameId}-${j.playId}`}>{etiquetaJugada(j)}</option>
          ))}
        </select>
      </div>

      <Estado cargando={cargando} error={error} />
      <Estado cargando={cargandoJugada} error={errorJugada} />
      {sel && listaLista && (
        <section className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
          <Reproductor key={`${jugada.gameId}-${jugada.playId}`} jugada={jugada} equipo={equipo} />
        </section>
      )}
      {lista && visibles.length === 0 && <p className="text-gray-500">No hay jugadas para este filtro.</p>}
    </div>
  )
}

// ---------- Reproductor ----------

function Reproductor({ jugada, equipo }: { jugada: JugadaPizarra; equipo: string }) {
  const tema = temaPizarra(equipo, jugada.ofensiva, jugada.defensiva)
  const { c1, c2 } = tema.equipo
  const acento = luminancia(c1) < 0.15 ? c2 : c1
  const max = jugada.frames.length - 1
  const { fps, snap } = jugada

  const [t, setT] = useState(0)
  const [reproduciendo, setReproduciendo] = useState(true)
  const [vel, setVel] = useState(1)
  const [rutas, setRutas] = useState(true)
  const [dorsales, setDorsales] = useState(true)
  const tRef = useRef(0)

  const ir = (v: number) => {
    tRef.current = v
    setT(v)
  }

  useEffect(() => {
    if (!reproduciendo) return
    let raf = 0
    // El primer frame solo fija la referencia de tiempo: la marca de rAF puede ser anterior a performance.now()
    let ultimo: number | null = null
    const paso = (ahora: number) => {
      const dt = ultimo === null ? 0 : Math.max(0, ahora - ultimo)
      const n = Math.max(0, Math.min(max, tRef.current + (dt / 1000) * fps * vel))
      ultimo = ahora
      tRef.current = n
      setT(n)
      if (n >= max) return setReproduciendo(false)
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [reproduciendo, vel, max, fps])

  // Encuadre fijo para toda la jugada (no se mueve la cámara mientras corre)
  const [x0, ancho, y0, alto] = useMemo(() => {
    let mn = Infinity
    let mx = -Infinity
    let ymn = Infinity
    let ymx = -Infinity
    const puntos = [...jugada.frames.flat(), ...(jugada.balon ?? [])]
    for (const p of puntos) {
      mn = Math.min(mn, p[0]); mx = Math.max(mx, p[0])
      ymn = Math.min(ymn, p[1]); ymx = Math.max(ymx, p[1])
    }
    // Se recorta el campo a donde ocurre la jugada para que la pizarra sea más grande en pantallas chicas
    const ajusta = (a: number, b: number, minimo: number, tope: number) => {
      let lo = Math.max(0, a - 6)
      let hi = Math.min(tope, b + 6)
      if (hi - lo < minimo) {
        const c = (lo + hi) / 2
        lo = Math.max(0, Math.min(c - minimo / 2, tope - minimo))
        hi = lo + minimo
      }
      return [lo, hi - lo]
    }
    const [xa, xw] = ajusta(mn, mx, 50, 120)
    const [ya, yh] = ajusta(ymn, ymx, 34, ANCHO)
    return [xa, xw, ya, yh]
  }, [jugada])

  const i = Math.max(0, Math.min(max, Math.floor(t)))
  const sig = Math.min(max, i + 1)
  const f = t - i
  const lerp = (a: number[], b: number[]) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  const pos = jugada.frames[i].map((p, k) => lerp(p, jugada.frames[sig][k]))
  const balon = jugada.balon ? lerp(jugada.balon[i], jugada.balon[sig]) : null

  const estela = (k: number) => {
    if (t < snap) return []
    const pts = jugada.frames.slice(snap, i + 1).map((fr) => fr[k])
    pts.push(pos[k])
    return pts
  }
  const estelaBalon = () => {
    if (!jugada.balon || t < snap) return []
    return [...jugada.balon.slice(snap, i + 1), balon as number[]]
  }

  const evento = [...jugada.eventos].reverse().find((e) => e.frame <= i)
  const segundos = (t - snap) / fps
  const los = jugada.linea_golpeo
  const primerDown = los === null ? null : los + jugada.yardsToGo

  const defensa = jugada.jugadores.map((j, k) => ({ j, k })).filter(({ j }) => j.bando === 'defensa')
  const ofensiva = jugada.jugadores.map((j, k) => ({ j, k })).filter(({ j }) => j.bando === 'ofensiva')

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="space-y-2">
        <svg
          viewBox={`${x0} ${y0} ${ancho} ${alto}`}
          className="block w-full rounded-lg shadow-lg"
          style={{ background: '#0E3B1D', height: 'clamp(300px, calc(100dvh - 290px), 780px)' }}
          role="img"
          aria-label="Pizarra animada de la jugada"
        >
          <Campo tema={tema} ofensiva={jugada.ofensiva} defensiva={jugada.defensiva} x0={x0} ancho={ancho} />

          {los !== null && <line x1={los} x2={los} y1={0} y2={ANCHO} stroke="#2F7BFF" strokeWidth={0.35} />}
          {primerDown !== null && <line x1={primerDown} x2={primerDown} y1={0} y2={ANCHO} stroke={ORO} strokeWidth={0.35} />}

          {rutas && (
            <g>
              {defensa.filter(({ j }) => j.rol === 'Pass Rush' || j.rol === 'Coverage').map(({ j, k }) => (
                <Trazo key={`d${j.id}`} pts={estela(k)} color="#FFFFFF" ancho={0.2} opacidad={0.35} guion />
              ))}
              {ofensiva.filter(({ j }) => j.rol === 'Pass Route' || j.rol === 'Pass').map(({ j, k }) => (
                <Trazo key={`o${j.id}`} pts={estela(k)} color={ORO} ancho={0.4} opacidad={0.95} flecha />
              ))}
              <Trazo pts={estelaBalon()} color="#FFFFFF" ancho={0.22} opacidad={0.8} guion />
            </g>
          )}

          {defensa.map(({ j, k }) => (
            <Marca key={j.id} j={j} p={pos[k]} color={tema.defensa} dorsal={dorsales} activo={t >= snap} />
          ))}
          {ofensiva.map(({ j, k }) => (
            <Marca key={j.id} j={j} p={pos[k]} color={tema.ofensiva} dorsal={dorsales} activo={t >= snap} />
          ))}

          {balon && (
            <g transform={`translate(${balon[0]} ${balon[1]})`}>
              <circle r={1.1} fill={ORO} opacity={0.35} />
              <ellipse rx={0.75} ry={0.45} fill="#7A3E17" stroke="#FFFFFF" strokeWidth={0.15} />
            </g>
          )}
        </svg>
        <input
          type="range"
          min={0}
          max={max}
          step={0.1}
          value={t}
          onChange={(e) => {
            setReproduciendo(false)
            ir(Number(e.target.value))
          }}
          className="w-full"
          style={{ accentColor: acento }}
          aria-label="Línea de tiempo de la jugada"
        />
      </div>

      <aside className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (reproduciendo) return setReproduciendo(false)
              if (t >= max) ir(0)
              setReproduciendo(true)
            }}
            className="w-24 rounded-md px-3 py-1.5 text-sm font-bold shadow"
            style={{ background: acento, color: textoSobre(acento) }}
          >
            {reproduciendo ? '⏸ Pausa' : t >= max ? '↻ Repetir' : '▶ Play'}
          </button>
          <button
            onClick={() => {
              setReproduciendo(false)
              ir(snap)
            }}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
            style={{ borderColor: acento, color: acento }}
          >
            Ir al snap
          </button>
          <div className="flex items-center gap-1 text-sm">
            {[0.25, 0.5, 1, 2].map((v) => (
              <button
                key={v}
                onClick={() => setVel(v)}
                className="rounded px-2 py-1 font-medium"
                style={vel === v ? { background: acento, color: textoSobre(acento) } : { background: '#E5E7EB', color: '#374151' }}
              >
                {v}x
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input type="checkbox" checked={rutas} onChange={(e) => setRutas(e.target.checked)} style={{ accentColor: acento }} /> Rutas
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input type="checkbox" checked={dorsales} onChange={(e) => setDorsales(e.target.checked)} style={{ accentColor: acento }} /> Dorsales
          </label>
          <div className="flex w-full items-center justify-between gap-2 text-sm">
            <span className="rounded px-2 py-0.5 font-semibold" style={{ background: c2, color: textoSobre(c2) }}>
              {evento ? (EVENTOS[evento.evento] ?? evento.evento) : 'Pre-snap'}
            </span>
            <span className="w-16 text-right font-mono text-gray-600">{segundos >= 0 ? '+' : ''}{segundos.toFixed(1)} s</span>
          </div>
        </div>
        <Leyenda tema={tema} jugada={jugada} />
        <p className="border-t pt-2 text-xs text-gray-600">{jugada.descripcion}</p>
      </aside>
    </div>
  )
}

function Leyenda({ tema, jugada }: { tema: TemaPizarra; jugada: JugadaPizarra }) {
  const item = (icono: ReactNode, texto: string) => (
    <span className="flex items-center gap-1.5">{icono}{texto}</span>
  )
  return (
    <div className="flex flex-col gap-1 text-xs text-gray-600">
      {item(<span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white shadow ring-1 ring-gray-300" style={{ background: tema.ofensiva }} />, `O = ofensiva (${jugada.ofensiva})`)}
      {item(<span className="font-black" style={{ color: tema.defensa, textShadow: '0 0 2px #000' }}>✕</span>, `X = defensa (${jugada.defensiva})`)}
      {item(<span className="inline-block h-0.5 w-5" style={{ background: ORO }} />, 'Ruta / QB')}
      {item(<span className="inline-block h-3.5 w-0.5" style={{ background: '#2F7BFF' }} />, 'Línea de golpeo')}
      {item(<span className="inline-block h-3.5 w-0.5" style={{ background: ORO }} />, 'Primer down')}
      {item(<span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: ROJO_ALERTA }} />, 'Presión (sack, hit o hurry)')}
    </div>
  )
}

// ---------- Elementos del campo ----------

function Campo({ tema, ofensiva, defensiva, x0, ancho }: { tema: TemaPizarra; ofensiva: string; defensiva: string; x0: number; ancho: number }) {
  const franjas = Array.from({ length: 20 }, (_, n) => 10 + n * 5)
  const lineas = Array.from({ length: 21 }, (_, n) => 10 + n * 5)
  const numeros = [20, 30, 40, 50, 60, 70, 80, 90, 100]
  const yardas = Array.from({ length: 101 }, (_, n) => 10 + n)
  const visible = (x: number) => x >= x0 - 6 && x <= x0 + ancho + 6
  return (
    <g>
      <rect x={-2} y={-2} width={124} height={ANCHO + 4} fill="#14522A" />
      {franjas.map((x, n) => (
        <rect key={x} x={x} y={0} width={5} height={ANCHO} fill={n % 2 ? '#1F7A3A' : '#278C43'} />
      ))}
      <rect x={0} y={0} width={10} height={ANCHO} fill={tema.ezOfensiva} />
      <rect x={110} y={0} width={10} height={ANCHO} fill={tema.ezDefensa} />
      <text transform={`translate(5 ${ANCHO / 2}) rotate(-90)`} textAnchor="middle" dominantBaseline="central" fontSize={6} fontWeight={900} letterSpacing={0.8} fill={textoSobre(tema.ezOfensiva)} opacity={0.9}>
        {ofensiva}
      </text>
      <text transform={`translate(115 ${ANCHO / 2}) rotate(90)`} textAnchor="middle" dominantBaseline="central" fontSize={6} fontWeight={900} letterSpacing={0.8} fill={textoSobre(tema.ezDefensa)} opacity={0.9}>
        {defensiva}
      </text>
      {lineas.filter(visible).map((x) => (
        <line key={x} x1={x} x2={x} y1={0} y2={ANCHO} stroke="#FFFFFF" strokeWidth={x === 10 || x === 110 ? 0.5 : 0.25} opacity={0.75} />
      ))}
      {yardas.filter(visible).map((x) => (
        <g key={x} stroke="#FFFFFF" strokeWidth={0.12} opacity={0.6}>
          <line x1={x} x2={x} y1={0} y2={0.7} />
          <line x1={x} x2={x} y1={ANCHO - 0.7} y2={ANCHO} />
          <line x1={x} x2={x} y1={23.08} y2={23.78} />
          <line x1={x} x2={x} y1={29.55} y2={30.25} />
        </g>
      ))}
      {numeros.filter(visible).map((x) => {
        const n = x <= 60 ? x - 10 : 110 - x
        return (
          <g key={x} fill="#FFFFFF" opacity={0.55} fontSize={3} fontWeight={800} textAnchor="middle">
            <text x={x} y={11}>{n}</text>
            <text x={x} y={ANCHO - 8.5}>{n}</text>
          </g>
        )
      })}
      <rect x={0} y={0} width={120} height={ANCHO} fill="none" stroke="#FFFFFF" strokeWidth={0.5} />
    </g>
  )
}

function Trazo({ pts, color, ancho, opacidad, guion, flecha }: { pts: number[][]; color: string; ancho: number; opacidad: number; guion?: boolean; flecha?: boolean }) {
  if (pts.length < 2) return null
  const d = pts.map((p, n) => `${n ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
  let punta = null
  if (flecha && pts.length > 5) {
    const fin = pts[pts.length - 1]
    const ref = pts[Math.max(0, pts.length - 6)]
    if (Math.hypot(fin[0] - ref[0], fin[1] - ref[1]) > 0.6) {
      const a = Math.atan2(fin[1] - ref[1], fin[0] - ref[0])
      const L = 1.4
      const lado = (s: number) => `${fin[0] - L * Math.cos(a + s * 0.45)},${fin[1] - L * Math.sin(a + s * 0.45)}`
      punta = <polygon points={`${fin[0]},${fin[1]} ${lado(1)} ${lado(-1)}`} fill={color} opacity={opacidad} />
    }
  }
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={ancho} opacity={opacidad} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={guion ? '0.6 0.6' : undefined} />
      {punta}
    </g>
  )
}

function Marca({ j, p, color, dorsal, activo }: { j: JugadorPizarra; p: number[]; color: string; dorsal: boolean; activo: boolean }) {
  const ofensiva = j.bando === 'ofensiva'
  const titulo = [j.dorsal !== null && `#${j.dorsal}`, j.nombre, j.pos && `(${j.pos})`, j.rol && `· ${j.rol}`].filter(Boolean).join(' ')
  return (
    <g transform={`translate(${p[0]} ${p[1]})`}>
      <title>{titulo}</title>
      {j.rol === 'Pass' && <circle r={1.9} fill="none" stroke={ORO} strokeWidth={0.25} />}
      {activo && j.impacto && <circle r={2.1} fill="none" stroke={ROJO_ALERTA} strokeWidth={0.35} className="animate-pulse" />}
      {ofensiva ? (
        <circle r={1.15} fill={color} stroke="#FFFFFF" strokeWidth={0.3} />
      ) : (
        <g strokeLinecap="round">
          <path d="M-0.95 -0.95L0.95 0.95M0.95 -0.95L-0.95 0.95" stroke="#FFFFFF" strokeWidth={1.1} />
          <path d="M-0.95 -0.95L0.95 0.95M0.95 -0.95L-0.95 0.95" stroke={color} strokeWidth={0.6} />
        </g>
      )}
      {dorsal && j.dorsal !== null && (
        ofensiva ? (
          <text y={0.05} textAnchor="middle" dominantBaseline="central" fontSize={1.15} fontWeight={800} fill={textoSobre(color)}>{j.dorsal}</text>
        ) : (
          <text y={2.6} textAnchor="middle" dominantBaseline="central" fontSize={1.15} fontWeight={800} fill="#FFFFFF" stroke="#000000" strokeWidth={0.12} paintOrder="stroke">{j.dorsal}</text>
        )
      )}
    </g>
  )
}
