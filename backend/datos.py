"""Carga y preparación de datos. Se calcula una sola vez al arrancar (el servidor es efímero)."""
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "data"

LINEA_OFENSIVA = ["LT", "LG", "C", "RG", "RT"]


@lru_cache(maxsize=1)
def jugadas() -> pd.DataFrame:
    """Una fila por dropback, con columnas derivadas listas para agrupar."""
    p = pd.read_csv(DATOS / "plays.csv", na_values=["NA"])
    p = p[p["down"] > 0].copy()  # down == 0: intentos de 2 puntos

    # absoluteYardlineNumber NO es distancia a la end zone: se calcula con yardlineSide.
    # yardlineSide es NA en la yarda 50.
    propio = p["yardlineSide"] == p["possessionTeam"]
    p["yds_ez"] = np.where(propio, 100 - p["yardlineNumber"], p["yardlineNumber"])

    # prePenaltyPlayResult para no mezclar yardas de castigo
    p["yds"] = p["prePenaltyPlayResult"].astype(float)

    # Éxito: 40 % de la distancia en 1ª, 60 % en 2ª, 100 % en 3ª y 4ª
    umbral = p["down"].map({1: 0.4, 2: 0.6, 3: 1.0, 4: 1.0}) * p["yardsToGo"]
    p["exito"] = (p["yds"] >= umbral).astype(float)

    # Presión y número de rushers según PFF (hit/hurry/sack valen 0 o 1 en Pass Rush)
    s = scouting()
    rush = s[s["pff_role"] == "Pass Rush"].copy()
    rush["presion"] = (rush[["pff_hit", "pff_hurry", "pff_sack"]].max(axis=1) >= 1).astype(int)
    por_jugada = rush.groupby(["gameId", "playId"]).agg(rushers=("nflId", "size"), presion=("presion", "max"))
    p = p.merge(por_jugada, how="left", left_on=["gameId", "playId"], right_index=True)
    # Una jugada sin filas de Pass Rush queda en NaN (dato faltante), no en 0

    p["es_man"] = (p["pff_passCoverageType"] == "Man").astype(float)
    p["es_zona"] = (p["pff_passCoverageType"] == "Zone").astype(float)
    p["blitz"] = np.where(p["rushers"].notna(), (p["rushers"] >= 5).astype(float), np.nan)
    p["pa"] = p["pff_playAction"].astype(float)
    p["intento"] = p["passResult"].isin(["C", "I", "IN"])
    p["completo"] = (p["passResult"] == "C").astype(float)
    p["sack"] = (p["passResult"] == "S").astype(float)

    # Etiquetas de agrupación
    p["g_down"] = p["down"].map({1: "1ª", 2: "2ª", 3: "3ª", 4: "4ª"})
    dist = np.select([p["yardsToGo"] <= 3, p["yardsToGo"] <= 7], ["corta (1-3)", "media (4-7)"], "larga (8+)")
    p["g_situacion"] = p["g_down"] + " y " + pd.Series(dist, index=p.index)
    p["g_zona"] = np.select(
        [p["yds_ez"] <= 20, p["yds_ez"] <= 49, p["yds_ez"] <= 79],
        ["Zona roja (≤20)", "Campo rival (21-49)", "Campo propio (50-79)"],
        "Cerca de la propia EZ (80+)",
    )
    p["g_formacion"] = p["offenseFormation"].fillna("N/D")
    p["g_personal"] = p["personnelO"].fillna("N/D")
    p["g_play_action"] = np.where(p["pa"] == 1, "Con play action", "Sin play action")
    p["g_cobertura"] = p["pff_passCoverage"].fillna("N/D")
    p["g_tipo_cobertura"] = p["pff_passCoverageType"].fillna("N/D")
    r = p["rushers"]
    p["g_rushers"] = np.select(
        [r.isna(), r <= 3, r == 4, r == 5], ["N/D", "3 o menos", "4 rushers", "5 rushers"], "6 o más"
    )
    return p.reset_index(drop=True)


@lru_cache(maxsize=1)
def scouting() -> pd.DataFrame:
    return pd.read_csv(DATOS / "pffScoutingData.csv", na_values=["NA"])


@lru_cache(maxsize=1)
def jugadores() -> pd.DataFrame:
    return pd.read_csv(DATOS / "players.csv", na_values=["NA"]).set_index("nflId")


@lru_cache(maxsize=1)
def equipos() -> list[str]:
    p = jugadas()
    return sorted(set(p["possessionTeam"]) | set(p["defensiveTeam"]))


@lru_cache(maxsize=1)
def scouting_con_contexto() -> pd.DataFrame:
    """Scouting de PFF unido al equipo ofensivo/defensivo de cada jugada (sin 2 puntos)."""
    p = jugadas()[["gameId", "playId", "possessionTeam", "defensiveTeam"]]
    return scouting().merge(p, on=["gameId", "playId"], how="inner")
