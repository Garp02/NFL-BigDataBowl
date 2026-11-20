import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi } from '../api'
import { Confiabilidad, Estado, Tarjeta } from '../components/ui'
import type { Lideres, Lineas } from '../types'

function Nota({ k, liga }: { k: number; liga: number }) {
  return (
    <p className="mt-2 text-xs text-gray-500">
      Tasa suavizada: se suman {k} jugadas imaginarias con la tasa de la liga ({liga} %) para que una muestra
      pequeña no domine el ranking. Presión = hit, hurry o sack.
    </p>
  )
}

export default function VistaLineas({ equipo }: { equipo: string }) {
  const { datos, error, cargando } = useApi<Lineas>(`lineas/${equipo}`)
  const lid = useApi<Lideres>('lineas/lideres')

  if (!datos || datos.equipo !== equipo) return <Estado cargando={cargando} error={error} />

  const prot = datos.proteccion
  const rush = datos.pass_rush
  const debil = prot.jugadores.find((j) => j.eslabon_debil)

  return (
    <div className="space-y-4">
      <Tarjeta titulo={`Protección de ${equipo}: línea ofensiva`}>
        {debil && (
          <p className="mb-3 rounded bg-red-50 p-3 text-sm text-red-800">
            Eslabón débil: <strong>{debil.jugador}</strong> ({debil.posicion}) permitió presión en {debil.presiones_permitidas} de{' '}
            {debil.snaps} jugadas ({debil.presion_pct} %, suavizada {debil.presion_suav_pct} %; liga {prot.liga_presion_pct} %).
          </p>
        )}
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={prot.jugadores} margin={{ top: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="jugador" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis unit="%" />
              <Tooltip />
              <ReferenceLine y={prot.liga_presion_pct} stroke="#6B7280" strokeDasharray="4 4" label={{ value: 'liga', fontSize: 11 }} />
              <Bar dataKey="presion_suav_pct" name="Presión permitida suavizada %">
                {prot.jugadores.map((j) => (
                  <Cell key={j.nfl_id} fill={j.eslabon_debil ? '#B91C1C' : '#2F7D4F'} fillOpacity={j.confianza === 'baja' ? 0.3 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="py-1 pr-3">Jugador</th><th className="pr-3">Pos.</th><th className="pr-3">Snaps</th>
                <th className="pr-3">Presiones</th><th className="pr-3">Sacks</th><th className="pr-3">Hits</th>
                <th className="pr-3">Hurries</th><th className="pr-3">Superado</th><th className="pr-3">Presión %</th>
                <th className="pr-3">Suavizada %</th><th>Confianza</th>
              </tr>
            </thead>
            <tbody>
              {prot.jugadores.map((j) => (
                <tr key={j.nfl_id} className={`border-b last:border-0 ${j.eslabon_debil ? 'bg-red-50' : ''}`}>
                  <td className="py-1 pr-3 font-medium">{j.jugador}</td><td className="pr-3">{j.posicion}</td>
                  <td className="pr-3">{j.snaps}</td><td className="pr-3">{j.presiones_permitidas}</td>
                  <td className="pr-3">{j.sacks}</td><td className="pr-3">{j.golpes}</td><td className="pr-3">{j.hurries}</td>
                  <td className="pr-3">{j.superado}</td><td className="pr-3">{j.presion_pct}</td>
                  <td className="pr-3">{j.presion_suav_pct}</td><td><Confiabilidad nivel={j.confianza} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Nota k={prot.k_suavizado} liga={prot.liga_presion_pct} />
      </Tarjeta>

      <TablaRushers titulo={`Pass rush de ${equipo}`} jugadores={rush.jugadores.slice(0, 12)} k={rush.k_suavizado} liga={rush.liga_presion_pct} />

      {lid.datos ? (
        <TablaRushers
          titulo={`Mejores pass rushers de la liga (mín. ${lid.datos.min_snaps} snaps)`}
          jugadores={lid.datos.jugadores}
          k={lid.datos.k_suavizado}
          liga={lid.datos.liga_presion_pct}
          mostrarEquipo
        />
      ) : (
        <Estado cargando={lid.cargando} error={lid.error} />
      )}
    </div>
  )
}

function TablaRushers({ titulo, jugadores, k, liga, mostrarEquipo = false }: {
  titulo: string
  jugadores: Lideres['jugadores']
  k: number
  liga: number
  mostrarEquipo?: boolean
}) {
  return (
    <Tarjeta titulo={titulo}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="py-1 pr-3">Jugador</th>{mostrarEquipo && <th className="pr-3">Equipo</th>}
              <th className="pr-3">Pos.</th><th className="pr-3">Snaps</th><th className="pr-3">Presiones</th>
              <th className="pr-3">Sacks</th><th className="pr-3">Hits</th><th className="pr-3">Hurries</th>
              <th className="pr-3">Presión %</th><th className="pr-3">Suavizada %</th><th>Confianza</th>
            </tr>
          </thead>
          <tbody>
            {jugadores.map((j) => (
              <tr key={`${j.nfl_id}-${j.equipo}`} className={`border-b last:border-0 ${j.confianza === 'baja' ? 'text-gray-400' : ''}`}>
                <td className="py-1 pr-3 font-medium">{j.jugador}</td>{mostrarEquipo && <td className="pr-3">{j.equipo}</td>}
                <td className="pr-3">{j.posicion}</td><td className="pr-3">{j.snaps}</td><td className="pr-3">{j.presiones}</td>
                <td className="pr-3">{j.sacks}</td><td className="pr-3">{j.golpes}</td><td className="pr-3">{j.hurries}</td>
                <td className="pr-3">{j.presion_pct}</td><td className="pr-3">{j.presion_suav_pct}</td>
                <td><Confiabilidad nivel={j.confianza} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Nota k={k} liga={liga} />
    </Tarjeta>
  )
}
