import { useEffect, useRef, useState } from 'react'
import { postJson } from '../api'
import { Tarjeta } from '../components/ui'
import { textoSobre } from '../teamColors'
import { useTema } from '../tema'

interface Mensaje { rol: 'user' | 'assistant'; texto: string; herramientas?: string[] }
interface Respuesta { respuesta: string; herramientas: string[] }

const NOMBRES_TOOLS: Record<string, string> = {
  consultar_equipo: 'reporte del equipo',
  consultar_lineas: 'líneas OL / pass rush',
  lideres_pass_rush: 'líderes de pass rush',
}

export default function Asistente({ equipo }: { equipo: string }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fin = useRef<HTMLDivElement>(null)
  const { acento, c2 } = useTema()
  const sobreAcento = textoSobre(acento)

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes, cargando])

  const sugerencias = [
    `¿Cómo ataca ${equipo} a la zona y al man?`,
    `¿Quién es el eslabón débil de la línea de ${equipo}?`,
    `¿Qué coberturas y blitz usa ${equipo} en 3ª y larga?`,
    `Dame un plan de juego contra la defensa de ${equipo}`,
  ]

  async function enviar(pregunta: string) {
    const p = pregunta.trim()
    if (!p || cargando) return
    const historial = mensajes.slice(-6).map((m) => ({ rol: m.rol, texto: m.texto }))
    setMensajes((m) => [...m, { rol: 'user', texto: p }])
    setTexto('')
    setError(null)
    setCargando(true)
    try {
      const r = await postJson<Respuesta>('asistente', { pregunta: p, equipo, historial })
      setMensajes((m) => [...m, { rol: 'assistant', texto: r.respuesta, herramientas: r.herramientas }])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <Tarjeta titulo="Asistente coach (Amazon Nova)">
      <p className="mb-3 text-xs text-gray-500">
        Los números vienen de las mismas funciones que alimentan las otras pestañas. El modelo solo interpreta y redacta.
        Equipo en pantalla: <strong>{equipo}</strong>.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {sugerencias.map((s) => (
          <button key={s} onClick={() => enviar(s)} disabled={cargando}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: acento, color: acento }}
            onMouseEnter={(e) => { e.currentTarget.style.background = acento; e.currentTarget.style.color = sobreAcento }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = acento }}>
            {s}
          </button>
        ))}
      </div>

      <div className="mb-3 max-h-[28rem] min-h-[8rem] space-y-3 overflow-y-auto rounded border border-gray-200 border-t-4 bg-gray-50 p-3"
        style={{ borderTopColor: c2 }}>
        {mensajes.length === 0 && <p className="text-sm text-gray-400">Haz una pregunta o elige una sugerencia.</p>}
        {mensajes.map((m, i) => (
          <div key={i} className={m.rol === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm ${m.rol === 'user' ? '' : 'border-l-4 bg-white text-gray-900 shadow-sm'}`}
              style={m.rol === 'user' ? { background: acento, color: sobreAcento } : { borderLeftColor: acento }}
            >
              {m.texto}
            </div>
            {m.herramientas && m.herramientas.length > 0 && (
              <div className="mt-1 text-xs text-gray-400">
                Consultó: {m.herramientas.map((t) => NOMBRES_TOOLS[t] ?? t).join(', ')}
              </div>
            )}
          </div>
        ))}
        {cargando && <p className="animate-pulse text-sm font-medium" style={{ color: acento }}>Analizando…</p>}
        <div ref={fin} />
      </div>

      {error && (
        <p className="mb-3 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
          {error} El resto del dashboard sigue funcionando.
        </p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void enviar(texto) }} className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={1000}
          placeholder="3ª y 8 en nuestro territorio, rival en shotgun, ¿qué llamamos?"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ ['--tw-ring-color' as string]: acento }}
        />
        <button type="submit" disabled={cargando || !texto.trim()}
          className="rounded px-4 py-2 text-sm font-semibold shadow disabled:opacity-50"
          style={{ background: acento, color: sobreAcento }}>
          Preguntar
        </button>
      </form>
    </Tarjeta>
  )
}
