"""Idea 3: eslabones débiles de la línea ofensiva y mejores pass rushers (PFF)."""
from functools import lru_cache

import pandas as pd

from .datos import LINEA_OFENSIVA, jugadores, scouting_con_contexto
from .reportes import N_BAJO, confianza

# Suavizado: se suman K "snaps" imaginarios con la tasa de la liga, para que
# una muestra pequeña no encabece el ranking por azar.
K_SUAVIZADO = 50
MIN_SNAPS_LIDERES = 100


def _nombre(nfl_id: int) -> str:
    j = jugadores()
    return str(j.loc[nfl_id, "displayName"]) if nfl_id in j.index else str(nfl_id)


def _moda(serie: pd.Series) -> str:
    return str(serie.mode().iloc[0])


def _suavizar(eventos: pd.Series, snaps: pd.Series, p0: float) -> pd.Series:
    return (eventos + K_SUAVIZADO * p0) / (snaps + K_SUAVIZADO) * 100


@lru_cache(maxsize=1)
def _bloqueadores() -> pd.DataFrame:
    s = scouting_con_contexto()
    b = s[(s["pff_role"] == "Pass Block") & (s["pff_positionLinedUp"].isin(LINEA_OFENSIVA))].copy()
    b["presion_perm"] = (b[["pff_hitAllowed", "pff_hurryAllowed", "pff_sackAllowed"]].max(axis=1) >= 1).astype(int)
    return b


@lru_cache(maxsize=1)
def _rushers() -> pd.DataFrame:
    s = scouting_con_contexto()
    r = s[s["pff_role"] == "Pass Rush"].copy()
    r["presion"] = (r[["pff_hit", "pff_hurry", "pff_sack"]].max(axis=1) >= 1).astype(int)
    return r


def _tabla_bloqueo(b: pd.DataFrame, p0: float) -> pd.DataFrame:
    t = b.groupby(["nflId", "possessionTeam"]).agg(
        posicion=("pff_positionLinedUp", _moda),
        snaps=("presion_perm", "size"),
        presiones=("presion_perm", "sum"),
        sacks=("pff_sackAllowed", "sum"),
        golpes=("pff_hitAllowed", "sum"),
        hurries=("pff_hurryAllowed", "sum"),
        superado=("pff_beatenByDefender", "sum"),
    ).reset_index()
    t["presion_pct"] = t["presiones"] / t["snaps"] * 100
    t["presion_suav_pct"] = _suavizar(t["presiones"], t["snaps"], p0)
    return t


@lru_cache(maxsize=32)
def proteccion(equipo: str) -> dict:
    b = _bloqueadores()
    p0 = b["presion_perm"].mean()
    t = _tabla_bloqueo(b[b["possessionTeam"] == equipo], p0)
    t = t.sort_values("presion_suav_pct", ascending=False)
    filas = []
    for i, f in enumerate(t.itertuples()):
        filas.append({
            "nfl_id": int(f.nflId),
            "jugador": _nombre(f.nflId),
            "posicion": f.posicion,
            "snaps": int(f.snaps),
            "presiones_permitidas": int(f.presiones),
            "sacks": int(f.sacks),
            "golpes": int(f.golpes),
            "hurries": int(f.hurries),
            "superado": int(f.superado),
            "presion_pct": round(f.presion_pct, 1),
            "presion_suav_pct": round(f.presion_suav_pct, 1),
            "confianza": confianza(int(f.snaps)),
            "eslabon_debil": i == 0 and f.snaps >= N_BAJO,
        })
    return {"liga_presion_pct": round(p0 * 100, 1), "k_suavizado": K_SUAVIZADO, "jugadores": filas}


def _filas_rush(t: pd.DataFrame) -> list[dict]:
    return [{
        "nfl_id": int(f.nflId),
        "jugador": _nombre(f.nflId),
        "equipo": f.defensiveTeam,
        "posicion": f.posicion,
        "snaps": int(f.snaps),
        "presiones": int(f.presiones),
        "sacks": int(f.sacks),
        "golpes": int(f.golpes),
        "hurries": int(f.hurries),
        "presion_pct": round(f.presion_pct, 1),
        "presion_suav_pct": round(f.presion_suav_pct, 1),
        "confianza": confianza(int(f.snaps)),
    } for f in t.itertuples()]


def _tabla_rush(r: pd.DataFrame, p0: float) -> pd.DataFrame:
    t = r.groupby(["nflId", "defensiveTeam"]).agg(
        posicion=("pff_positionLinedUp", _moda),
        snaps=("presion", "size"),
        presiones=("presion", "sum"),
        sacks=("pff_sack", "sum"),
        golpes=("pff_hit", "sum"),
        hurries=("pff_hurry", "sum"),
    ).reset_index()
    t["presion_pct"] = t["presiones"] / t["snaps"] * 100
    t["presion_suav_pct"] = _suavizar(t["presiones"], t["snaps"], p0)
    return t.sort_values("presion_suav_pct", ascending=False)


@lru_cache(maxsize=32)
def pass_rush(equipo: str) -> dict:
    r = _rushers()
    p0 = r["presion"].mean()
    t = _tabla_rush(r[r["defensiveTeam"] == equipo], p0)
    return {"liga_presion_pct": round(p0 * 100, 1), "k_suavizado": K_SUAVIZADO, "jugadores": _filas_rush(t)}


@lru_cache(maxsize=1)
def lideres_pass_rush() -> dict:
    r = _rushers()
    p0 = r["presion"].mean()
    t = _tabla_rush(r, p0)
    t = t[t["snaps"] >= MIN_SNAPS_LIDERES].head(15)
    return {
        "liga_presion_pct": round(p0 * 100, 1),
        "k_suavizado": K_SUAVIZADO,
        "min_snaps": MIN_SNAPS_LIDERES,
        "jugadores": _filas_rush(t),
    }
