"""Reporte de scouting de un equipo (ofensiva o defensa). Todos los números salen de pandas."""
from functools import lru_cache

import numpy as np
import pandas as pd

from .datos import jugadas

N_BAJO = 30   # por debajo: advertencia explícita
N_ALTO = 100  # desde aquí: confianza alta

ORDEN_FIJO = {
    "down": ["1ª", "2ª", "3ª", "4ª"],
    "zona": ["Cerca de la propia EZ (80+)", "Campo propio (50-79)", "Campo rival (21-49)", "Zona roja (≤20)"],
    "rushers": ["3 o menos", "4 rushers", "5 rushers", "6 o más", "N/D"],
    "situacion": [f"{d} y {t}" for d in ["1ª", "2ª", "3ª", "4ª"] for t in ["corta (1-3)", "media (4-7)", "larga (8+)"]],
}

DESGLOSES = {
    "ofensiva": {
        "down": "Por down",
        "situacion": "Por down y distancia",
        "zona": "Por zona del campo",
        "formacion": "Por formación",
        "personal": "Por personal",
        "play_action": "Play action",
        "tipo_cobertura": "Contra man / zona",
        "cobertura": "Contra cada cobertura",
        "rushers": "Contra número de rushers",
    },
    "defensa": {
        "cobertura": "Mix de coberturas",
        "tipo_cobertura": "Man / zona",
        "down": "Por down",
        "situacion": "Por down y distancia",
        "zona": "Por zona del campo",
        "formacion": "Contra formación rival",
        "personal": "Contra personal rival",
        "play_action": "Contra play action",
        "rushers": "Por número de rushers",
    },
}


def confianza(n: int) -> str:
    return "baja" if n < N_BAJO else "media" if n < N_ALTO else "alta"


def _r(x, d=1):
    return None if x is None or pd.isna(x) else round(float(x), d)


def metricas(df: pd.DataFrame) -> dict:
    n = len(df)
    intentos = df["intento"].sum()
    return {
        "n": int(n),
        "confianza": confianza(n),
        "yds_jugada": _r(df["yds"].mean(), 2),
        "exito_pct": _r(df["exito"].mean() * 100),
        "comp_pct": _r(df.loc[df["intento"], "completo"].mean() * 100) if intentos else None,
        "sack_pct": _r(df["sack"].mean() * 100),
        "presion_pct": _r(df["presion"].mean() * 100),
        "blitz_pct": _r(df["blitz"].mean() * 100),
        "man_pct": _r(df["es_man"].mean() * 100),
        "pa_pct": _r(df["pa"].mean() * 100),
    } if n else {"n": 0, "confianza": "baja"}


def _desglose(df: pd.DataFrame, liga: pd.DataFrame, clave: str) -> list[dict]:
    col = f"g_{clave}"
    total = len(df)
    filas = []
    liga_g = {g: x for g, x in liga.groupby(col)}
    for g, x in df.groupby(col):
        m = metricas(x)
        m["grupo"] = g
        m["uso_pct"] = _r(len(x) / total * 100)
        lg = liga_g.get(g)
        # Diferencia contra la liga solo si la liga tiene muestra suficiente en ese grupo
        if lg is not None and len(lg) >= N_ALTO:
            m["liga_yds_jugada"] = _r(lg["yds"].mean(), 2)
            m["liga_uso_pct"] = _r(len(lg) / len(liga) * 100)
        filas.append(m)
    orden = ORDEN_FIJO.get(clave)
    if orden:
        filas.sort(key=lambda f: orden.index(f["grupo"]) if f["grupo"] in orden else 99)
    else:
        filas.sort(key=lambda f: -f["n"])
    if clave == "personal":
        filas = filas[:7]
    return filas


def _hallazgos(lado: str, df: pd.DataFrame, liga: pd.DataFrame, res: dict, liga_res: dict, desg: dict) -> list[dict]:
    """Observaciones automáticas. Cada una lleva su n y su confianza."""
    out = []

    def add(texto, n):
        out.append({"texto": texto, "n": int(n), "confianza": confianza(int(n))})

    def dif(clave, nombre, unidad="pts"):
        a, b = res.get(clave), liga_res.get(clave)
        if a is None or b is None:
            return None
        return f"{nombre}: {a:.1f} % (liga {b:.1f} %, {a - b:+.1f} {unidad})"

    # Rendimiento global
    a, b = res["yds_jugada"], liga_res["yds_jugada"]
    verbo = "ofensiva" if lado == "ofensiva" else "defensa (yardas permitidas)"
    add(f"Rendimiento de la {verbo}: {a:.2f} yds por dropback (liga {b:.2f}, {a - b:+.2f}).", res["n"])

    if lado == "ofensiva":
        f = desg["formacion"]
        if f:
            top = f[0]
            add(f"Formación más usada: {top['grupo']} en {top['uso_pct']:.0f} % de sus dropbacks "
                f"(liga {top.get('liga_uso_pct', float('nan')):.0f} %), con {top['yds_jugada']:.2f} yds por jugada.", top["n"])
        add(dif("pa_pct", "Uso de play action") or "", res["n"])
        pa = {x["grupo"]: x for x in desg["play_action"]}
        if "Con play action" in pa and "Sin play action" in pa:
            c, s = pa["Con play action"], pa["Sin play action"]
            n_min = min(c["n"], s["n"])
            add(f"Con play action promedia {c['yds_jugada']:.2f} yds y sin él {s['yds_jugada']:.2f}.", n_min)
        tc = {x["grupo"]: x for x in desg["tipo_cobertura"]}
        if "Man" in tc and "Zone" in tc:
            m, z = tc["Man"], tc["Zone"]
            mejor, peor = (m, z) if m["yds_jugada"] >= z["yds_jugada"] else (z, m)
            nombre = {"Man": "man", "Zone": "zona"}
            add(f"Rinde mejor contra {nombre[mejor['grupo']]} ({mejor['yds_jugada']:.2f} yds, éxito {mejor['exito_pct']:.0f} %) "
                f"que contra {nombre[peor['grupo']]} ({peor['yds_jugada']:.2f} yds, éxito {peor['exito_pct']:.0f} %).",
                min(m["n"], z["n"]))
        add(dif("presion_pct", "Presión recibida") or "", res["n"])
    else:
        c = desg["cobertura"]
        if c:
            top = c[0]
            add(f"Cobertura más usada: {top['grupo']} en {top['uso_pct']:.0f} % de las jugadas "
                f"(liga {top.get('liga_uso_pct', float('nan')):.0f} %).", top["n"])
        add(dif("man_pct", "Uso de man") or "", res["n"])
        add(dif("blitz_pct", "Blitz (5+ rushers)") or "", res["n"])
        add(dif("presion_pct", "Presión generada") or "", res["n"])
        sit = {x["grupo"]: x for x in desg["situacion"]}
        t3 = sit.get("3ª y larga (8+)")
        if t3:
            add(f"En 3ª y larga usa man {t3['man_pct']:.0f} % y blitz {t3['blitz_pct']:.0f} % "
                f"(permite {t3['yds_jugada']:.2f} yds por jugada).", t3["n"])
    return [h for h in out if h["texto"]]


@lru_cache(maxsize=64)
def reporte(equipo: str, lado: str) -> dict:
    liga = jugadas()
    col = "possessionTeam" if lado == "ofensiva" else "defensiveTeam"
    df = liga[liga[col] == equipo]
    res, liga_res = metricas(df), metricas(liga)
    desg = {k: _desglose(df, liga, k) for k in DESGLOSES[lado]}
    return {
        "equipo": equipo,
        "lado": lado,
        "juegos": int(df["gameId"].nunique()),
        "resumen": res,
        "liga": liga_res,
        "etiquetas": DESGLOSES[lado],
        "desgloses": desg,
        "hallazgos": _hallazgos(lado, df, liga, res, liga_res, desg),
        "nota": "Solo dropbacks (pases, sacks y scrambles) de las semanas 1-8 de 2021. "
                "Yardas = prePenaltyPlayResult. Éxito: 40 % / 60 % / 100 % de la distancia en 1ª / 2ª / 3ª-4ª.",
    }
