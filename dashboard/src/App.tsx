import { useState } from 'react'
import { useApi } from './api'
import { Estado } from './components/ui'
import Asistente from './views/Asistente'
import Lineas from './views/Lineas'
import ReporteEquipo from './views/ReporteEquipo'

const VISTAS = [
  { id: 'ofensiva', nombre: 'Ataque del rival' },
  { id: 'defensa', nombre: 'Defensa del rival' },
  { id: 'lineas', nombre: 'Líneas (OL / pass rush)' },
  { id: 'asistente', nombre: 'Asistente IA' },
] as const

type Vista = (typeof VISTAS)[number]['id']

export default function App() {
  const { datos: equipos, error, cargando } = useApi<string[]>('equipos')
  const [equipo, setEquipo] = useState('KC')
  const [vista, setVista] = useState<Vista>('ofensiva')

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scouting del rival</h1>
          <p className="text-sm text-gray-600">Dropbacks de las semanas 1-8 de 2021 (NFL Big Data Bowl + PFF)</p>
        </div>
        <label className="text-sm text-gray-700">
          Equipo rival{' '}
          <select
            value={equipo}
            onChange={(e) => setEquipo(e.target.value)}
            className="ml-1 rounded border border-gray-300 bg-white px-2 py-1"
          >
            {(equipos ?? [equipo]).map((e) => <option key={e}>{e}</option>)}
          </select>
        </label>
      </header>

      <nav className="flex gap-1 border-b">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${vista === v.id ? 'border-green-700 text-green-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            {v.nombre}
          </button>
        ))}
      </nav>

      <Estado cargando={cargando} error={error} />
      {vista === 'lineas' && <Lineas equipo={equipo} />}
      {vista === 'asistente' && <Asistente equipo={equipo} />}
      {(vista === 'ofensiva' || vista === 'defensa') && <ReporteEquipo equipo={equipo} lado={vista} />}
    </main>
  )
}
