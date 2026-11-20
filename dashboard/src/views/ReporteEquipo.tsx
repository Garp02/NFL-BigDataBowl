import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi } from '../api'
import { Confiabilidad, Estado, Kpi, Tarjeta } from '../components/ui'
import type { Fila, Reporte } from '../types'

type Lado = 'ofensiva' | 'defensa'

const METRICAS: { clave: keyof Fila; nombre: string }[] = [
  { clave: 'yds_jugada', nombre: 'Yds por jugada' },
  { clave: 'exito_pct', nombre: 'Éxito %' },
  { clave: 'comp_pct', nombre: 'Comp. %' },
  { clave: 'sack_pct', nombre: 'Sack %' },
  { clave: 'presion_pct', nombre: 'Presión %' },
  { clave: 'blitz_pct', nombre: 'Blitz %' },
  { clave: 'man_pct', nombre: 'Man %' },
  { clave: 'uso_pct', nombre: 'Uso %' },
]

// Solo estas métricas tienen su equivalente de liga en el backend
const CLAVE_LIGA: Partial<Record<keyof Fila, keyof Fila>> = { yds_jugada: 'liga_yds_jugada', uso_pct: 'liga_uso_pct' }

const f = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? '—' : x.toFixed(d))

function Desglose({ filas, equipo }: { filas: Fila[]; equipo: string }) {
  const [metrica, setMetrica] = useState<keyof Fila>('yds_jugada')
  const claveLiga = CLAVE_LIGA[metrica]
  const datos = filas.map((x) => ({
    grupo: x.grupo,
    valor: x[metrica] as number | null,
    liga: claveLiga ? (x[claveLiga] as number | undefined) : undefined,
    bajo: x.confianza === 'baja',
  }))
  const hayLiga = datos.some((d) => d.liga !== undefined)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {METRICAS.map((m) => (
          <button
            key={m.clave}
            onClick={() => setMetrica(m.clave)}
            className={`rounded px-2 py-1 text-xs ${metrica === m.clave ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {m.nombre}
          </button>
        ))}
      </div>

      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="grupo" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar dataKey="valor" name={equipo} fill="#2F7D4F">
              {datos.map((d, i) => <Cell key={i} fill="#2F7D4F" fillOpacity={d.bajo ? 0.3 : 1} />)}
            </Bar>
            {hayLiga && <Bar dataKey="liga" name="Liga" fill="#9CA3AF" />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-500">Las barras tenues tienen n &lt; 30: no concluyas con ellas.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="py-1 pr-3">Grupo</th><th className="pr-3">n</th><th className="pr-3">Uso %</th>
              <th className="pr-3">Yds/jug.</th><th className="pr-3">Liga</th><th className="pr-3">Éxito %</th>
              <th className="pr-3">Comp. %</th><th className="pr-3">Sack %</th><th className="pr-3">Presión %</th>
              <th className="pr-3">Blitz %</th><th className="pr-3">Man %</th><th>Confianza</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((x) => (
              <tr key={x.grupo} className={`border-b last:border-0 ${x.confianza === 'baja' ? 'text-gray-400' : ''}`}>
                <td className="py-1 pr-3 font-medium">{x.grupo}</td>
                <td className="pr-3">{x.n}</td><td className="pr-3">{f(x.uso_pct)}</td>
                <td className="pr-3">{f(x.yds_jugada, 2)}</td><td className="pr-3">{f(x.liga_yds_jugada, 2)}</td>
                <td className="pr-3">{f(x.exito_pct)}</td><td className="pr-3">{f(x.comp_pct)}</td>
                <td className="pr-3">{f(x.sack_pct)}</td><td className="pr-3">{f(x.presion_pct)}</td>
                <td className="pr-3">{f(x.blitz_pct)}</td><td className="pr-3">{f(x.man_pct)}</td>
                <td><Confiabilidad nivel={x.confianza} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReporteEquipo({ equipo, lado }: { equipo: string; lado: Lado }) {
  const { datos, error, cargando } = useApi<Reporte>(`equipo/${equipo}/${lado}`)
  const [seleccion, setSeleccion] = useState<string | null>(null)

  if (!datos || datos.equipo !== equipo || datos.lado !== lado) return <Estado cargando={cargando} error={error} />

  const { resumen: r, liga: l } = datos
  const of = lado === 'ofensiva'
  const claves = Object.keys(datos.desgloses)
  const activa = seleccion && claves.includes(seleccion) ? seleccion : claves[0]

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {equipo} {of ? 'en ataque' : 'en defensa'}: {r.n} dropbacks en {datos.juegos} juegos.
        {r.confianza === 'baja' && <span className="ml-2 text-red-700">Muestra pequeña, interpreta con cuidado.</span>}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Kpi etiqueta={of ? 'Yds/dropback' : 'Yds permitidas'} valor={r.yds_jugada} liga={l.yds_jugada} mejorSiAlto={of} />
        <Kpi etiqueta="Éxito %" valor={r.exito_pct} liga={l.exito_pct} mejorSiAlto={of} />
        <Kpi etiqueta="Comp. %" valor={r.comp_pct} liga={l.comp_pct} mejorSiAlto={of} />
        <Kpi etiqueta="Sack %" valor={r.sack_pct} liga={l.sack_pct} mejorSiAlto={!of} />
        <Kpi etiqueta={of ? 'Presión recibida %' : 'Presión generada %'} valor={r.presion_pct} liga={l.presion_pct} mejorSiAlto={!of} />
        <Kpi etiqueta="Blitz %" valor={r.blitz_pct} liga={l.blitz_pct} mejorSiAlto={null} />
        <Kpi etiqueta="Man %" valor={r.man_pct} liga={l.man_pct} mejorSiAlto={null} />
        <Kpi etiqueta="Play action %" valor={r.pa_pct} liga={l.pa_pct} mejorSiAlto={null} />
      </div>

      <Tarjeta titulo="Hallazgos">
        <ul className="space-y-1 text-sm">
          {datos.hallazgos.map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span>• {h.texto} <span className="text-gray-400">(n={h.n})</span></span>
              {h.confianza !== 'alta' && <Confiabilidad nivel={h.confianza} />}
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Tendencias">
        <div className="mb-3 flex flex-wrap gap-1 border-b pb-3">
          {claves.map((k) => (
            <button
              key={k}
              onClick={() => setSeleccion(k)}
              className={`rounded px-3 py-1 text-sm ${activa === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {datos.etiquetas[k]}
            </button>
          ))}
        </div>
        <Desglose key={`${equipo}-${lado}-${activa}`} filas={datos.desgloses[activa]} equipo={equipo} />
      </Tarjeta>

      <p className="text-xs text-gray-500">{datos.nota}</p>
    </div>
  )
}
