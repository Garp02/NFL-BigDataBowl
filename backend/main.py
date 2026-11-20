"""API del reporte de scouting. Ejecuta: .venv/bin/uvicorn backend.main:app --reload"""
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from . import datos, lineas, reportes

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


# El build del dashboard se sirve en la misma URL y puerto (debe ir al final)
_dist = datos.RAIZ / "dashboard" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="dashboard")
