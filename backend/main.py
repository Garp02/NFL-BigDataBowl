"""API del reporte de scouting. Ejecuta: .venv/bin/uvicorn backend.main:app --reload"""
import logging
import os
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


def cargar_env():
    f = Path(__file__).resolve().parent.parent / ".env"
    if f.exists():
        for linea in f.read_text(encoding="utf-8-sig").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


cargar_env()

from . import datos, lineas, reportes  # noqa: E402  (después de cargar .env, antes de usar boto3)

log = logging.getLogger("uvicorn.error")

app = FastAPI(title="Hackathon NFL UNAM")

# Se calculan al arrancar: el servidor es efímero y no escribe en disco
datos.jugadas()
datos.scouting_con_contexto()


def _validar(equipo: str) -> str:
    equipo = equipo.upper()
    if equipo not in datos.equipos():
        raise HTTPException(status_code=404, detail=f"Equipo desconocido: {equipo}")
    return equipo


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/equipos")
def equipos() -> list[str]:
    return datos.equipos()


@app.get("/api/equipo/{equipo}/{lado}")
def reporte_equipo(equipo: str, lado: Literal["ofensiva", "defensa"]) -> dict:
    return reportes.reporte(_validar(equipo), lado)


@app.get("/api/lineas/lideres")
def lideres() -> dict:
    return lineas.lideres_pass_rush()


@app.get("/api/lineas/{equipo}")
def lineas_equipo(equipo: str) -> dict:
    equipo = _validar(equipo)
    return {"equipo": equipo, "proteccion": lineas.proteccion(equipo), "pass_rush": lineas.pass_rush(equipo)}


class Turno(BaseModel):
    rol: Literal["user", "assistant"]
    texto: str = Field(min_length=1, max_length=4000)


class Pregunta(BaseModel):
    pregunta: str = Field(min_length=1, max_length=1000)
    equipo: str | None = None
    historial: list[Turno] = Field(default_factory=list, max_length=8)


@app.post("/api/asistente")
def asistente(entrada: Pregunta) -> dict:
    """Asistente coach con IA. Es opcional: si falla, el resto de la app sigue funcionando."""
    equipo = _validar(entrada.equipo) if entrada.equipo else None
    try:
        from . import asistente as ia  # import diferido: la app arranca aunque la IA no esté disponible

        return ia.preguntar(entrada.pregunta, equipo, [t.model_dump() for t in entrada.historial])
    except Exception as e:
        # Solo el tipo de error: nunca se registran credenciales ni mensajes completos
        log.error("Asistente IA no disponible: %s", type(e).__name__)
        raise HTTPException(status_code=503, detail="El asistente de IA no está disponible en este momento.")


# El build del dashboard se sirve en la misma URL y puerto (debe ir al final)
_dist = datos.RAIZ / "dashboard" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="dashboard")
