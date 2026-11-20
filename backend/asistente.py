"""Asistente coach con Strands + Amazon Nova (Bedrock).

Principio de diseño: el LLM nunca inventa números. Todo número sale de las
herramientas (funciones de pandas); el modelo solo elige herramienta, interpreta y redacta.
"""
import os
import re

from strands import Agent, tool
from strands.models import BedrockModel

from . import datos, lineas, reportes

CAMPOS_FILA = ["grupo", "n", "confianza", "uso_pct", "yds_jugada", "liga_yds_jugada", "exito_pct",
               "comp_pct", "sack_pct", "presion_pct", "blitz_pct", "man_pct"]


def _equipo(equipo: str) -> str:
    e = equipo.strip().upper()
    if e not in datos.equipos():
        raise ValueError(f"Equipo desconocido: {equipo}. Usa la abreviatura: {', '.join(datos.equipos())}")
    return e


@tool
def consultar_equipo(equipo: str, lado: str, desglose: str = "") -> dict:
    """Reporte de scouting de un equipo (dropbacks de las semanas 1-8 de 2021).

    Args:
        equipo: Abreviatura NFL del equipo, por ejemplo KC, BUF, DAL.
        lado: "ofensiva" para analizar su ataque, "defensa" para analizar su defensa.
        desglose: Opcional. Clave de una tabla de tendencias. Para ofensiva: down, situacion, zona,
            formacion, personal, play_action, tipo_cobertura, cobertura, rushers.
            Para defensa: cobertura, tipo_cobertura, down, situacion, zona, formacion, personal,
            play_action, rushers. Si va vacío solo devuelve el resumen y los hallazgos.
    """
    if lado not in ("ofensiva", "defensa"):
        raise ValueError("lado debe ser 'ofensiva' o 'defensa'")
    r = reportes.reporte(_equipo(equipo), lado)
    out = {
        "equipo": r["equipo"], "lado": lado, "juegos": r["juegos"],
        "resumen": r["resumen"], "liga": r["liga"],
        "hallazgos": r["hallazgos"], "nota": r["nota"],
    }
    if desglose in r["desgloses"]:
        out["desglose"] = desglose
        out["filas"] = [{k: f[k] for k in CAMPOS_FILA if k in f} for f in r["desgloses"][desglose]]
    else:
        out["desgloses_disponibles"] = r["etiquetas"]
    return out


@tool
def consultar_lineas(equipo: str) -> dict:
    """Línea ofensiva (eslabón débil en protección) y pass rush de un equipo.

    Args:
        equipo: Abreviatura NFL del equipo, por ejemplo KC, BUF, DAL.
    """
    e = _equipo(equipo)
    prot = lineas.proteccion(e)
    rush = lineas.pass_rush(e)
    campos_ol = ["jugador", "posicion", "snaps", "presiones_permitidas", "presion_pct", "presion_suav_pct",
                 "confianza", "eslabon_debil"]
    campos_dl = ["jugador", "posicion", "snaps", "presiones", "sacks", "presion_pct", "presion_suav_pct", "confianza"]
    return {
        "equipo": e,
        "proteccion": {
            "liga_presion_pct": prot["liga_presion_pct"],
            "linea_ofensiva": [{k: j[k] for k in campos_ol} for j in prot["jugadores"]],
        },
        "pass_rush": {
            "liga_presion_pct": rush["liga_presion_pct"],
            "mejores": [{k: j[k] for k in campos_dl} for j in rush["jugadores"][:8]],
        },
        "nota": "presion_suav_pct es la tasa suavizada hacia la media de la liga; úsala para ordenar.",
    }


@tool
def lideres_pass_rush() -> dict:
    """Los 15 mejores pass rushers de la liga (mínimo 100 snaps), por tasa de presión suavizada."""
    return lineas.lideres_pass_rush()


PROMPT = """Eres un analista de scouting que asesora a un coach de la NFL. Respondes en español, de forma breve y concreta.

Datos: solo dropbacks (pases, sacks y scrambles) de las semanas 1-8 de 2021. NO hay datos de carreras, punts, goles de campo ni de receptores individuales; si te lo piden, dilo.

Reglas:
- Todo número que menciones debe venir de una herramienta. Nunca inventes ni estimes cifras. Si no tienes el dato, llama a la herramienta o di que no está disponible.
- Junto a cada hallazgo importante indica la muestra (n). Si n < 30, escribe literalmente "muestra pequeña (n=...)" y no conviertas ese dato en una recomendación firme.
- No relaciones jugadores de distinto lado (un pass rusher de la defensa no juega en la línea ofensiva). No expliques tácticas que las herramientas no respalden: limítate a lo que muestran los datos.
- Compara contra la liga cuando la herramienta lo dé.
- Termina con una recomendación accionable cuando la pregunta sea "qué hacer". Puedes usar varias herramientas.
- Formato: texto simple, listas con guiones, sin tablas, sin encabezados ni negritas markdown. No muestres tu razonamiento interno.
- Equipos: usa la abreviatura NFL (Chiefs=KC, Bills=BUF, Cowboys=DAL, etc.). Disponibles: {equipos}.

Cómo leer las herramientas (el rival es el equipo del que se pregunta):
- "Cómo ataca X" o "cómo protege X": consultar_equipo(X, "ofensiva") y la sección proteccion de consultar_lineas(X), que es la línea ofensiva de X.
- "Contra la defensa de X" o "cómo defiende X": consultar_equipo(X, "defensa") y la sección pass_rush de consultar_lineas(X), que son los pass rushers de X. La línea ofensiva de X NO es relevante para atacar a su defensa.
- Si el coach pregunta qué hacer contra X, el plan se basa en lo que X hace y en sus debilidades, no en las del equipo del coach, de quien no tienes datos.
{contexto}"""


def preguntar(pregunta: str, equipo: str | None, historial: list[dict]) -> dict:
    modelo = BedrockModel(
        model_id=os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0"),
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
        temperature=0.2,
    )
    contexto = f"\nEl coach está viendo en pantalla al equipo {equipo}." if equipo else ""
    mensajes = [{"role": h["rol"], "content": [{"text": h["texto"]}]} for h in historial]
    agente = Agent(
        model=modelo,
        system_prompt=PROMPT.format(equipos=", ".join(datos.equipos()), contexto=contexto),
        tools=[consultar_equipo, consultar_lineas, lideres_pass_rush],
        messages=mensajes,
        callback_handler=None,
    )
    resultado = agente(pregunta)
    herramientas = list(getattr(resultado.metrics, "tool_metrics", {}).keys())
    return {"respuesta": _limpiar(str(resultado)), "herramientas": herramientas}


def _limpiar(texto: str) -> str:
    """Quita el razonamiento interno (<thinking>) y las negritas markdown que el modelo a veces emite."""
    texto = re.sub(r"<thinking>.*?</thinking>", "", texto, flags=re.DOTALL | re.IGNORECASE)
    return texto.replace("**", "").strip()
