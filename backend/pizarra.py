"""Datos para la pizarra animada: lista de jugadas de un equipo y tracking frame a frame de una jugada."""
from functools import lru_cache

import pandas as pd

from . import datos

ANCHO_CAMPO = 160 / 3  # yardas (53.33)
LARGO_CAMPO = 120.0
FPS = 10  # el tracking de la NFL va a 10 frames por segundo

RESULTADO = {"C": "Pase completo", "I": "Pase incompleto", "S": "Sack", "IN": "Intercepción", "R": "Scramble"}
EVENTOS_SNAP = ("ball_snap", "autoevent_ballsnap")


@lru_cache(maxsize=1)
def _partidos() -> pd.DataFrame:
    return pd.read_csv(datos.DATOS / "games.csv", na_values=["NA"]).set_index("gameId")


def _a_none(v):
    return None if pd.isna(v) else v


def lista(equipo: str) -> list[dict]:
    """Dropbacks en los que el equipo jugó, ya sea en ataque o en defensa, en orden cronológico."""
    p = datos.jugadas()
    p = p[(p["possessionTeam"] == equipo) | (p["defensiveTeam"] == equipo)]
    p = p.assign(semana=p["gameId"].map(_partidos()["week"])).sort_values(["semana", "gameId", "playId"])
    salida = []
    for r in p.itertuples():
        ataca = r.possessionTeam == equipo
        yds = _a_none(r.yds)
        salida.append({
            "gameId": int(r.gameId),
            "playId": int(r.playId),
            "semana": int(r.semana),
            "ofensiva": r.possessionTeam,
            "defensiva": r.defensiveTeam,
            "lado": "ofensiva" if ataca else "defensa",
            "rival": r.defensiveTeam if ataca else r.possessionTeam,
            "quarter": int(r.quarter),
            "down": int(r.down),
            "yardsToGo": int(r.yardsToGo),
            "reloj": r.gameClock,
            "resultado": RESULTADO.get(r.passResult, "N/D"),
            "yds": None if yds is None else int(yds),
            "descripcion": r.playDescription,
        })
    return salida


@lru_cache(maxsize=64)
def jugada(game_id: int, play_id: int) -> dict | None:
    """Posiciones por frame de todos los jugadores y el balón. La ofensiva siempre avanza hacia la derecha (x creciente)."""
    fila = datos.jugadas()
    fila = fila[(fila["gameId"] == game_id) & (fila["playId"] == play_id)]
    ruta = datos.DATOS / "tracking" / f"tracking_{game_id}.csv"
    if fila.empty or not ruta.exists():
        return None
    info = fila.iloc[0]

    t = pd.read_csv(
        ruta,
        na_values=["NA"],
        usecols=["gameId", "playId", "nflId", "frameId", "jerseyNumber", "team", "playDirection", "x", "y", "event"],
    )
    t = t[t["playId"] == play_id].drop_duplicates(["nflId", "frameId"])
    if t.empty:
        return None

    # Se voltea la cancha cuando la ofensiva va a la izquierda (rotación de 180°)
    if (t["playDirection"] == "left").any():
        t = t.assign(x=LARGO_CAMPO - t["x"], y=ANCHO_CAMPO - t["y"])

    t["clave"] = t["nflId"].fillna(-1).astype(int)  # -1 = balón
    x = t.pivot(index="frameId", columns="clave", values="x").sort_index().interpolate(limit_direction="both")
    y = t.pivot(index="frameId", columns="clave", values="y").sort_index().interpolate(limit_direction="both")
    ids = [c for c in x.columns if c != -1 and x[c].notna().all() and y[c].notna().all()]

    frames = [
        [[round(float(px), 2), round(float(py), 2)] for px, py in zip(x.loc[f, ids], y.loc[f, ids])]
        for f in x.index
    ]
    balon = None
    if -1 in x.columns and x[-1].notna().all() and y[-1].notna().all():
        balon = [[round(float(a), 2), round(float(b), 2)] for a, b in zip(x[-1], y[-1])]

    # Datos de cada jugador: dorsal, equipo, rol PFF y nombre
    base = t[t["clave"].isin(ids)].drop_duplicates("clave").set_index("clave")
    s = datos.scouting()
    s = s[(s["gameId"] == game_id) & (s["playId"] == play_id)].set_index("nflId")
    nombres = datos.jugadores()
    jugadores = []
    for i in ids:
        sc = s.loc[i] if i in s.index else None
        pj = nombres.loc[i] if i in nombres.index else None
        impacto = None
        if sc is not None:
            impacto = "sack" if sc["pff_sack"] == 1 else "hit" if sc["pff_hit"] == 1 else "hurry" if sc["pff_hurry"] == 1 else None
        jugadores.append({
            "id": int(i),
            "dorsal": None if pd.isna(base.loc[i, "jerseyNumber"]) else int(base.loc[i, "jerseyNumber"]),
            "equipo": base.loc[i, "team"],
            "bando": "ofensiva" if base.loc[i, "team"] == info["possessionTeam"] else "defensa",
            "pos": _a_none(sc["pff_positionLinedUp"]) if sc is not None else (_a_none(pj["officialPosition"]) if pj is not None else None),
            "rol": _a_none(sc["pff_role"]) if sc is not None else None,
            "nombre": _a_none(pj["displayName"]) if pj is not None else None,
            "impacto": impacto,
        })

    # Eventos etiquetados (snap, pase, recepción, tackle...) como índice de frame
    ev = t.dropna(subset=["event"])
    ev = ev[ev["event"] != "None"].drop_duplicates(["frameId", "event"]).sort_values("frameId")
    eventos = [{"frame": int(x.index.get_loc(r.frameId)), "evento": r.event} for r in ev.itertuples()]
    snap = next((e["frame"] for nombre in EVENTOS_SNAP for e in eventos if e["evento"] == nombre), 0)

    # Línea de golpeo = posición del balón en el snap; si no hay balón, se omite
    los = balon[snap][0] if balon else None

    return {
        "gameId": game_id,
        "playId": play_id,
        "ofensiva": info["possessionTeam"],
        "defensiva": info["defensiveTeam"],
        "down": int(info["down"]),
        "yardsToGo": int(info["yardsToGo"]),
        "descripcion": info["playDescription"],
        "fps": FPS,
        "snap": snap,
        "linea_golpeo": los,
        "jugadores": jugadores,
        "frames": frames,
        "balon": balon,
        "eventos": eventos,
    }
