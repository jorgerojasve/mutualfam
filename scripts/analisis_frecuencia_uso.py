#!/usr/bin/env python3
"""
==============================================================================
 MutualFam - Script de Análisis Estadístico de Uso y Frecuencia en BD
==============================================================================
 Uso:
   python3 scripts/analisis_frecuencia_uso.py [opciones]

 Opciones:
   --env=all|qa|prod     Entorno a analizar (por defecto: all)
   --qa=RUTA             Ruta a la base de datos de QA
   --prod=RUTA           Ruta a la base de datos de Producción
   --fetch               Descargar respaldos actualizados desde Fly.io antes de analizar
   --json=RUTA           Exportar resultados estructurados a un archivo JSON
   --markdown=RUTA       Exportar informe formateado en Markdown

 Descripción:
   Extrae y analiza todas las marcas de tiempo de actividad real de los usuarios
   registradas en la base de datos SQLite (usuarios, asamblea/debates, préstamos,
   colectas, membresías, etc.), convirtiendo automáticamente los registros UTC a
   la hora local de Venezuela (VET, UTC-4). Calcula frecuencias en el tiempo,
   promedios por día del mes, por día de la semana y por hora del día.
==============================================================================
"""

import sys
import os
import argparse
import sqlite3
import json
import subprocess
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter

# Zona horaria de Venezuela: UTC-4
VET_TZ = timezone(timedelta(hours=-4))

DIAS_SEMANA_ES = [
    "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"
]

FRANJAS_HORARIAS = {
    "Madrugada (00:00 - 05:59)": range(0, 6),
    "Mañana    (06:00 - 11:59)": range(6, 12),
    "Tarde     (12:00 - 17:59)": range(12, 18),
    "Noche     (18:00 - 23:59)": range(18, 24),
}


def parse_datetime(val):
    """Parsea una cadena de fecha/hora de SQLite y la convierte de UTC a VET (UTC-4)."""
    if not val:
        return None
    val_str = str(val).strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            dt = datetime.strptime(val_str, fmt)
            # Las fechas en backend se guardan en UTC sin tzinfo
            return dt.replace(tzinfo=timezone.utc).astimezone(VET_TZ)
        except ValueError:
            continue
    return None


def fetch_database_from_fly(env_name, script_root):
    """Invoca el script oficial de respaldo para descargar la BD de Fly.io."""
    backup_script = os.path.join(script_root, "scripts", "backup_prod_db.sh")
    if not os.path.exists(backup_script):
        print(f"⚠️  No se encontró {backup_script}. No se puede descargar.")
        return
    print(f"⬇️  Descargando base de datos fresca para {env_name.upper()} vía Fly.io...")
    cmd = [backup_script, f"--env={env_name}"]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode == 0:
        print(f"✔ Respaldo descargado exitosamente para {env_name.upper()}.")
    else:
        print(f"❌ Error al descargar respaldo: {res.stderr}")


def extract_events_from_db(db_path):
    """Extrae cronológicamente todas las acciones de usuarios registradas en la BD."""
    if not os.path.exists(db_path):
        return None, f"El archivo no existe: {db_path}"

    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
    except Exception as e:
        return None, f"No se pudo conectar a SQLite: {e}"

    # Tablas existentes
    tables = set(
        r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    )

    events = []

    # 1. Registro de Usuarios
    if "users" in tables:
        for r in cur.execute("SELECT id, first_name, last_name, email, created_at FROM users"):
            dt = parse_datetime(r[4])
            if dt:
                events.append({
                    "dt": dt,
                    "modulo": "Membresía / Usuarios",
                    "accion": "Registro de usuario",
                    "usuario": f"{r[1]} {r[2]}".strip() or r[3],
                    "detalle": r[3],
                })

    # 2. Afiliación / Ingreso a Mutual
    if "organization_memberships" in tables:
        for r in cur.execute(
            """SELECT m.id, u.first_name, u.last_name, u.email, m.joined_at 
               FROM organization_memberships m 
               LEFT JOIN users u ON m.user_id = u.id"""
        ):
            dt = parse_datetime(r[4])
            if dt:
                events.append({
                    "dt": dt,
                    "modulo": "Membresía / Usuarios",
                    "accion": "Ingreso a organización",
                    "usuario": f"{r[1]} {r[2]}".strip() if r[1] else (r[3] or "Socio"),
                    "detalle": "Membresía activa",
                })

    # 3. Invitaciones Creadas
    if "organization_invites" in tables:
        for r in cur.execute("SELECT id, created_by_user_id, created_at FROM organization_invites"):
            dt = parse_datetime(r[2])
            if dt:
                events.append({
                    "dt": dt,
                    "modulo": "Membresía / Usuarios",
                    "accion": "Creación de invitación",
                    "usuario": f"Usuario #{r[1]}",
                    "detalle": f"Código de invitación #{r[0]}",
                })

    # 4. Propuestas en Asamblea
    if "proposals" in tables:
        for r in cur.execute(
            """SELECT p.id, p.title, p.category, u.first_name, u.last_name, p.created_at 
               FROM proposals p 
               LEFT JOIN users u ON p.author_id = u.id"""
        ):
            dt = parse_datetime(r[5])
            if dt:
                events.append({
                    "dt": dt,
                    "modulo": "Gobernanza / Asamblea",
                    "accion": "Creación de propuesta",
                    "usuario": f"{r[3]} {r[4]}".strip() if r[3] else "Proponente",
                    "detalle": f"[{r[2]}] {r[1]}",
                })

    # 5. Participación en Foro de Debate
    if "comments" in tables:
        for r in cur.execute(
            """SELECT c.id, c.proposal_id, u.first_name, u.last_name, c.created_at, c.attachment_type 
               FROM comments c 
               LEFT JOIN users u ON c.author_id = u.id"""
        ):
            dt = parse_datetime(r[4])
            if dt:
                tipo_adj = f" con {r[5]}" if r[5] else ""
                events.append({
                    "dt": dt,
                    "modulo": "Gobernanza / Asamblea",
                    "accion": "Mensaje en foro debate",
                    "usuario": f"{r[2]} {r[3]}".strip() if r[2] else "Participante",
                    "detalle": f"Intervención en propuesta #{r[1]}{tipo_adj}",
                })

    # 6. Votaciones en Asamblea
    if "votes" in tables:
        for r in cur.execute(
            """SELECT v.id, v.proposal_id, m.first_name, m.last_name, v.updated_at 
               FROM votes v 
               LEFT JOIN members m ON v.member_id = m.id"""
        ):
            dt = parse_datetime(r[4])
            if dt:
                events.append({
                    "dt": dt,
                    "modulo": "Gobernanza / Asamblea",
                    "accion": "Emisión de voto",
                    "usuario": f"{r[2]} {r[3]}".strip() if r[2] else "Votante",
                    "detalle": f"Voto en propuesta #{r[1]}",
                })

    # 7. Solicitudes de Préstamos
    if "loan_requests" in tables:
        for r in cur.execute(
            """SELECT l.id, u.first_name, u.last_name, l.amount_usd, l.motive, 
                      l.created_at, l.funded_at, l.repaid_at 
               FROM loan_requests l 
               LEFT JOIN users u ON l.requester_id = u.id"""
        ):
            usr = f"{r[1]} {r[2]}".strip() if r[1] else "Prestatario"
            dt_c = parse_datetime(r[5])
            if dt_c:
                events.append({
                    "dt": dt_c,
                    "modulo": "Préstamos Familiares",
                    "accion": "Solicitud de préstamo",
                    "usuario": usr,
                    "detalle": f"${r[3]:.2f} USD ({r[4]})",
                })
            dt_f = parse_datetime(r[6])
            if dt_f:
                events.append({
                    "dt": dt_f,
                    "modulo": "Préstamos Familiares",
                    "accion": "Préstamo 100% fondeado",
                    "usuario": usr,
                    "detalle": f"${r[3]:.2f} USD completado",
                })
            dt_r = parse_datetime(r[7])
            if dt_r:
                events.append({
                    "dt": dt_r,
                    "modulo": "Préstamos Familiares",
                    "accion": "Préstamo totalmente devuelto",
                    "usuario": usr,
                    "detalle": f"${r[3]:.2f} USD liquidado",
                })

    # 8. Aportes a Préstamos
    if "loan_contributions" in tables:
        for r in cur.execute(
            """SELECT c.id, c.loan_request_id, u.first_name, u.last_name, c.amount_usd, 
                      c.status, c.created_at 
               FROM loan_contributions c 
               LEFT JOIN users u ON c.funder_id = u.id"""
        ):
            dt = parse_datetime(r[6])
            if dt:
                events.append({
                    "dt": dt,
                    "modulo": "Préstamos Familiares",
                    "accion": f"Aporte a préstamo ({r[5]})",
                    "usuario": f"{r[2]} {r[3]}".strip() if r[2] else "Financiador",
                    "detalle": f"${r[4]:.2f} USD a solicitud #{r[1]}",
                })

    # 9. Devoluciones de Préstamos
    if "loan_repayments" in tables:
        for r in cur.execute(
            """SELECT r.id, r.contribution_id, r.amount_usd, r.status, 
                      r.created_at, r.verified_at 
               FROM loan_repayments r"""
        ):
            dt_c = parse_datetime(r[4])
            if dt_c:
                events.append({
                    "dt": dt_c,
                    "modulo": "Préstamos Familiares",
                    "accion": "Pago/Devolución de préstamo",
                    "usuario": "Prestatario",
                    "detalle": f"${r[2]:.2f} USD devueltos",
                })
            dt_v = parse_datetime(r[5])
            if dt_v:
                events.append({
                    "dt": dt_v,
                    "modulo": "Préstamos Familiares",
                    "accion": "Verificación de devolución",
                    "usuario": "Aportante",
                    "detalle": f"${r[2]:.2f} USD confirmados",
                })

    # 10. Colectas Solidarias ("Vacas")
    if "colectas" in tables:
        for r in cur.execute(
            """SELECT c.id, c.titulo, u.first_name, u.last_name, c.monto_meta_usd, 
                      c.created_at, c.ultimo_recordatorio_manual 
               FROM colectas c 
               LEFT JOIN users u ON c.proponente_id = u.id"""
        ):
            dt_c = parse_datetime(r[5])
            if dt_c:
                events.append({
                    "dt": dt_c,
                    "modulo": "Colectas Solidarias",
                    "accion": "Creación de colecta",
                    "usuario": f"{r[2]} {r[3]}".strip() if r[2] else "Proponente",
                    "detalle": f"Meta ${r[4]:.2f} USD: {r[1]}",
                })
            dt_r = parse_datetime(r[6])
            if dt_r:
                events.append({
                    "dt": dt_r,
                    "modulo": "Colectas Solidarias",
                    "accion": "Recordatorio manual enviado",
                    "usuario": f"{r[2]} {r[3]}".strip() if r[2] else "Gestor",
                    "detalle": f"Colecta #{r[0]}: {r[1]}",
                })

    # 11. Compromisos y Aportes en Colectas
    if "compromisos_colecta" in tables:
        for r in cur.execute(
            """SELECT c.id, c.colecta_id, u.first_name, u.last_name, c.monto_usd,
                      c.fecha_compromiso, c.fecha_notificacion, c.fecha_pago, 
                      c.fecha_validacion, c.fecha_rechazo, c.motivo_rechazo 
               FROM compromisos_colecta c 
               LEFT JOIN users u ON c.socio_id = u.id"""
        ):
            usr = f"{r[2]} {r[3]}".strip() if r[2] else "Aportante"
            monto = f"${r[4]:.2f} USD" if r[4] is not None else ""

            # Promesa
            dt_comp = parse_datetime(r[5])
            if dt_comp:
                events.append({
                    "dt": dt_comp,
                    "modulo": "Colectas Solidarias",
                    "accion": "Compromiso/Promesa de aporte",
                    "usuario": usr,
                    "detalle": f"{monto} a colecta #{r[1]}",
                })

            # Notificación en Bs
            dt_notif = parse_datetime(r[6])
            if dt_notif:
                events.append({
                    "dt": dt_notif,
                    "modulo": "Colectas Solidarias",
                    "accion": "Notificación de pago en Bs",
                    "usuario": usr,
                    "detalle": f"{monto} notificado en Bs",
                })

            # Pago informado / subida de comprobante
            dt_pago = parse_datetime(r[7])
            if dt_pago:
                events.append({
                    "dt": dt_pago,
                    "modulo": "Colectas Solidarias",
                    "accion": "Pago notificado con comprobante",
                    "usuario": usr,
                    "detalle": f"{monto} pagado en colecta #{r[1]}",
                })

            # Validación por gestor
            dt_val = parse_datetime(r[8])
            if dt_val:
                events.append({
                    "dt": dt_val,
                    "modulo": "Colectas Solidarias",
                    "accion": "Validación de pago recibida",
                    "usuario": "Gestor de colecta",
                    "detalle": f"{monto} validado de {usr}",
                })

            # Rechazo por gestor
            dt_rech = parse_datetime(r[9])
            if dt_rech:
                motivo = f": {r[10]}" if r[10] else ""
                events.append({
                    "dt": dt_rech,
                    "modulo": "Colectas Solidarias",
                    "accion": "Rechazo de pago por gestor",
                    "usuario": "Gestor de colecta",
                    "detalle": f"Aporte de {usr} rechazado{motivo}",
                })

    conn.close()

    # Orden cronológico
    events.sort(key=lambda x: x["dt"])
    return events, None


def analyze_events(events):
    """Calcula todas las métricas de frecuencia temporal, promedios y distribuciones."""
    if not events:
        return {
            "total_eventos": 0,
            "periodo": None,
            "dias_totales_observados": 0,
            "dias_activos": 0,
            "promedio_diario_general": 0.0,
            "promedio_diario_dias_activos": 0.0,
            "por_fecha": {},
            "por_dia_mes": {},
            "por_dia_semana": {},
            "por_hora": {},
            "por_franja": {},
            "por_modulo": {},
            "por_usuario": {},
        }

    total = len(events)
    primera_fecha = events[0]["dt"]
    ultima_fecha = events[-1]["dt"]

    # Rango de fechas
    inicio_dia = primera_fecha.date()
    fin_dia = ultima_fecha.date()
    dias_rango = (fin_dia - inicio_dia).days + 1

    # Agrupaciones
    eventos_por_fecha = defaultdict(int)
    eventos_por_dia_mes = defaultdict(int)
    eventos_por_dia_semana = defaultdict(int)
    eventos_por_hora = defaultdict(int)
    eventos_por_modulo = defaultdict(int)
    eventos_por_usuario = defaultdict(int)

    # Conteo de ocurrencia de días específicos en el rango del calendario
    dias_semana_en_rango = defaultdict(int)
    dias_mes_en_rango = defaultdict(int)

    cur_d = inicio_dia
    while cur_d <= fin_dia:
        dias_semana_en_rango[cur_d.weekday()] += 1
        dias_mes_en_rango[cur_d.day] += 1
        cur_d += timedelta(days=1)

    for ev in events:
        dt = ev["dt"]
        f_str = dt.strftime("%Y-%m-%d")
        eventos_por_fecha[f_str] += 1
        eventos_por_dia_mes[dt.day] += 1
        eventos_por_dia_semana[dt.weekday()] += 1
        eventos_por_hora[dt.hour] += 1
        eventos_por_modulo[ev["modulo"]] += 1
        eventos_por_usuario[ev["usuario"]] += 1

    dias_activos = len(eventos_por_fecha)

    # Promedios por Día del Mes (1 al 31)
    stat_dia_mes = {}
    for dia in range(1, 32):
        cnt = eventos_por_dia_mes[dia]
        ocurrencias = dias_mes_en_rango[dia]
        pct = (cnt / total * 100) if total > 0 else 0.0
        promedio = (cnt / ocurrencias) if ocurrencias > 0 else 0.0
        stat_dia_mes[dia] = {
            "conteo": cnt,
            "porcentaje": pct,
            "dias_calendario": ocurrencias,
            "promedio": promedio,
        }

    # Promedios por Día de la Semana (0=Lunes ... 6=Domingo)
    stat_dia_semana = {}
    for w in range(7):
        cnt = eventos_por_dia_semana[w]
        ocurrencias = dias_semana_en_rango[w]
        pct = (cnt / total * 100) if total > 0 else 0.0
        promedio = (cnt / ocurrencias) if ocurrencias > 0 else 0.0
        stat_dia_semana[DIAS_SEMANA_ES[w]] = {
            "weekday_index": w,
            "conteo": cnt,
            "porcentaje": pct,
            "dias_calendario": ocurrencias,
            "promedio": promedio,
        }

    # Promedios por Hora (0 a 23 en VET)
    stat_hora = {}
    for h in range(24):
        cnt = eventos_por_hora[h]
        pct = (cnt / total * 100) if total > 0 else 0.0
        promedio_por_dia_activo = (cnt / dias_activos) if dias_activos > 0 else 0.0
        promedio_por_dia_rango = (cnt / dias_rango) if dias_rango > 0 else 0.0
        stat_hora[h] = {
            "hora": f"{h:02d}:00 - {h:02d}:59",
            "conteo": cnt,
            "porcentaje": pct,
            "promedio_dias_activos": promedio_por_dia_activo,
            "promedio_dias_calendario": promedio_por_dia_rango,
        }

    # Por Franja Horaria
    stat_franja = {}
    for nombre_franja, horas in FRANJAS_HORARIAS.items():
        cnt = sum(eventos_por_hora[h] for h in horas)
        pct = (cnt / total * 100) if total > 0 else 0.0
        stat_franja[nombre_franja] = {
            "conteo": cnt,
            "porcentaje": pct,
            "promedio_diario": (cnt / dias_activos) if dias_activos > 0 else 0.0,
        }

    return {
        "total_eventos": total,
        "primera_fecha": primera_fecha.strftime("%Y-%m-%d %H:%M:%S VET"),
        "ultima_fecha": ultima_fecha.strftime("%Y-%m-%d %H:%M:%S VET"),
        "dias_totales_rango": dias_rango,
        "dias_activos": dias_activos,
        "promedio_diario_general": total / dias_rango if dias_rango > 0 else 0.0,
        "promedio_diario_dias_activos": total / dias_activos if dias_activos > 0 else 0.0,
        "por_fecha": dict(sorted(eventos_por_fecha.items())),
        "por_dia_mes": stat_dia_mes,
        "por_dia_semana": stat_dia_semana,
        "por_hora": stat_hora,
        "por_franja": stat_franja,
        "por_modulo": dict(sorted(eventos_por_modulo.items(), key=lambda x: x[1], reverse=True)),
        "por_usuario": dict(sorted(eventos_por_usuario.items(), key=lambda x: x[1], reverse=True)),
    }


def render_ascii_bar(val, max_val, max_bars=25):
    """Genera una barra ASCII proporcional."""
    if max_val <= 0 or val <= 0:
        return ""
    bars = int(round((val / max_val) * max_bars))
    return "█" * max(bars, 1)


def print_env_report(label, stats, events):
    """Imprime en consola un informe visual y exhaustivo para un entorno."""
    sep = "=" * 80
    subsep = "-" * 80

    print("\n" + sep)
    print(f" 📊 REPORTE DE FRECUENCIAS Y ESTADÍSTICAS DE USO: ENTORNO {label.upper()}")
    print(sep)

    if stats["total_eventos"] == 0:
        print(" ⚠️  No se encontraron registros de actividad en este entorno.")
        print(sep + "\n")
        return

    print(f" • Total de eventos analizados:       {stats['total_eventos']} eventos")
    print(f" • Período observado:                 {stats['primera_fecha']}  ➔  {stats['ultima_fecha']}")
    print(f" • Días calendario en rango:          {stats['dias_totales_rango']} día(s)")
    print(f" • Días con actividad registrada:     {stats['dias_activos']} día(s)")
    print(f" • Frecuencia diaria (días activos):  {stats['promedio_diario_dias_activos']:.2f} eventos/día")
    print(f" • Frecuencia diaria (todo el rango): {stats['promedio_diario_general']:.2f} eventos/día")

    # 1. Timeline por fecha
    print("\n" + subsep)
    print(" 📅 1. ACTIVIDAD EN EL TIEMPO (LÍNEA CRONOLÓGICA)")
    print(subsep)
    print(f" {'Fecha':12} | {'Día':10} | {'Eventos':8} | {'Gráfica de Intensidad'}")
    print(f" {'-'*12} | {'-'*10} | {'-'*8} | {'-'*40}")
    max_d = max(stats["por_fecha"].values()) if stats["por_fecha"] else 1
    for f_str, cnt in stats["por_fecha"].items():
        dt_obj = datetime.strptime(f_str, "%Y-%m-%d")
        dia_nom = DIAS_SEMANA_ES[dt_obj.weekday()]
        bar = render_ascii_bar(cnt, max_d, 35)
        print(f" {f_str:12} | {dia_nom:10} | {cnt:8d} | {bar}")

    # 2. Por Día de la Semana
    print("\n" + subsep)
    print(" 📆 2. DISTRIBUCIÓN Y PROMEDIOS POR DÍA DE LA SEMANA")
    print(subsep)
    print(f" {'Día':10} | {'Total':6} | {'% Total':8} | {'Ocurrencias':11} | {'Promedio/Día':13} | {'Gráfica'}")
    print(f" {'-'*10} | {'-'*6} | {'-'*8} | {'-'*11} | {'-'*13} | {'-'*20}")
    max_sem = max(d["conteo"] for d in stats["por_dia_semana"].values()) if stats["por_dia_semana"] else 1
    for dia_nom, d in stats["por_dia_semana"].items():
        bar = render_ascii_bar(d["conteo"], max_sem, 20)
        print(f" {dia_nom:10} | {d['conteo']:6d} | {d['porcentaje']:6.1f}% | {d['dias_calendario']:11d} | {d['promedio']:13.2f} | {bar}")

    # 3. Por Día del Mes
    print("\n" + subsep)
    print(" 🗓️  3. FRECUENCIAS POR DÍA DEL MES (DÍAS CON ACTIVIDAD)")
    print(subsep)
    print(f" {'Día del Mes':12} | {'Total Eventos':14} | {'% del Total':12} | {'Promedio/Ocurrencia':20} | {'Gráfica'}")
    print(f" {'-'*12} | {'-'*14} | {'-'*12} | {'-'*20} | {'-'*20}")
    dias_con_actividad = {k: v for k, v in stats["por_dia_mes"].items() if v["conteo"] > 0}
    max_dm = max(v["conteo"] for v in dias_con_actividad.values()) if dias_con_actividad else 1
    for dia, d in sorted(dias_con_actividad.items()):
        bar = render_ascii_bar(d["conteo"], max_dm, 20)
        print(f" Día {dia:02d}      | {d['conteo']:14d} | {d['porcentaje']:10.1f}% | {d['promedio']:20.2f} | {bar}")

    # 4. Por Hora del Día (VET)
    print("\n" + subsep)
    print(" ⏰ 4. DISTRIBUCIÓN HORARIA Y PROMEDIOS POR HORA (HORA LOCAL VENEZUELA UTC-4)")
    print(subsep)
    print(f" {'Franja Horaria':17} | {'Total':6} | {'% Total':8} | {'Prom/Día Activo':16} | {'Distribución Horaria'}")
    print(f" {'-'*17} | {'-'*6} | {'-'*8} | {'-'*16} | {'-'*25}")
    max_h = max(d["conteo"] for d in stats["por_hora"].values()) if stats["por_hora"] else 1
    for h in range(24):
        d = stats["por_hora"][h]
        if d["conteo"] > 0:
            bar = render_ascii_bar(d["conteo"], max_h, 25)
            print(f" {d['hora']:17} | {d['conteo']:6d} | {d['porcentaje']:6.1f}% | {d['promedio_dias_activos']:16.2f} | {bar}")

    # 5. Por Franja del Día
    print("\n" + subsep)
    print(" 🌅 5. CONSOLIDADO POR FRANJA DEL DÍA")
    print(subsep)
    max_f = max(d["conteo"] for d in stats["por_franja"].values()) if stats["por_franja"] else 1
    for franja, d in stats["por_franja"].items():
        bar = render_ascii_bar(d["conteo"], max_f, 25)
        print(f" • {franja:27}: {d['conteo']:3d} eventos ({d['porcentaje']:5.1f}%) | {bar}")

    # 6. Desglose por Módulo
    print("\n" + subsep)
    print(" 🧩 6. ACTIVIDAD POR MÓDULO FUNCIONAL")
    print(subsep)
    max_mod = max(stats["por_modulo"].values()) if stats["por_modulo"] else 1
    for mod, cnt in stats["por_modulo"].items():
        pct = (cnt / stats["total_eventos"]) * 100
        bar = render_ascii_bar(cnt, max_mod, 25)
        print(f" • {mod:24}: {cnt:3d} ({pct:5.1f}%) | {bar}")

    # 7. Usuarios Más Activos
    print("\n" + subsep)
    print(" 👤 7. INTERACCIONES POR USUARIO")
    print(subsep)
    max_u = max(stats["por_usuario"].values()) if stats["por_usuario"] else 1
    for usr, cnt in stats["por_usuario"].items():
        pct = (cnt / stats["total_eventos"]) * 100
        bar = render_ascii_bar(cnt, max_u, 25)
        print(f" • {usr:32}: {cnt:3d} interacciones ({pct:5.1f}%) | {bar}")

    print(sep + "\n")


def print_comparison_table(stats_qa, stats_prod):
    """Imprime tabla comparativa lado a lado entre QA y Producción."""
    sep = "=" * 80
    print("\n" + sep)
    print(" ⚖️  RESUMEN COMPARATIVO: PRODUCCIÓN VS. QA")
    print(sep)
    print(f" {'Métrica':35} | {'PRODUCCIÓN':18} | {'QA':18}")
    print(f" {'-'*35} | {'-'*18} | {'-'*18}")
    print(f" {'Total de eventos de usuario':35} | {stats_prod['total_eventos']:18d} | {stats_qa['total_eventos']:18d}")
    print(f" {'Días con actividad':35} | {stats_prod['dias_activos']:18d} | {stats_qa['dias_activos']:18d}")
    print(f" {'Días calendario en rango':35} | {stats_prod['dias_totales_rango']:18d} | {stats_qa['dias_totales_rango']:18d}")
    print(f" {'Promedio diario (días activos)':35} | {stats_prod['promedio_diario_dias_activos']:18.2f} | {stats_qa['promedio_diario_dias_activos']:18.2f}")
    print(f" {'Promedio diario (rango total)':35} | {stats_prod['promedio_diario_general']:18.2f} | {stats_qa['promedio_diario_general']:18.2f}")

    # Franjas
    print(f" {'-'*35} | {'-'*18} | {'-'*18}")
    print(f" {'Horas Pico Más Frecuentes':35} |", end="")
    h_prod = sorted(stats_prod["por_hora"].items(), key=lambda x: x[1]["conteo"], reverse=True)
    top_h_prod = [f"{h[0]:02d}h ({h[1]['conteo']})" for h in h_prod if h[1]["conteo"] > 0][:2]
    print(f" {', '.join(top_h_prod) or 'N/A':18} |", end="")
    h_qa = sorted(stats_qa["por_hora"].items(), key=lambda x: x[1]["conteo"], reverse=True)
    top_h_qa = [f"{h[0]:02d}h ({h[1]['conteo']})" for h in h_qa if h[1]["conteo"] > 0][:2]
    print(f" {', '.join(top_h_qa) or 'N/A':18}")

    # Días pico
    print(f" {'Días con Mayor Actividad':35} |", end="")
    d_prod = sorted(stats_prod["por_dia_semana"].items(), key=lambda x: x[1]["conteo"], reverse=True)
    top_d_prod = [f"{k[:3]} ({v['conteo']})" for k, v in d_prod if v["conteo"] > 0][:2]
    print(f" {', '.join(top_d_prod) or 'N/A':18} |", end="")
    d_qa = sorted(stats_qa["por_dia_semana"].items(), key=lambda x: x[1]["conteo"], reverse=True)
    top_d_qa = [f"{k[:3]} ({v['conteo']})" for k, v in d_qa if v["conteo"] > 0][:2]
    print(f" {', '.join(top_d_qa) or 'N/A':18}")

    print(sep + "\n")


def generate_markdown_report(stats_qa, stats_prod, md_path):
    """Genera un archivo Markdown completo con el informe."""
    lines = [
        "# 📊 Informe Estadístico de Frecuencia y Uso en Base de Datos - MutualFam",
        "",
        "> **Zona horaria de referencia:** Venezuela (`UTC-4`, VET).",
        "> **Fuente:** Tablas transaccionales de SQLite (`users`, `organization_memberships`, `proposals`, `comments`, `loan_requests`, `loan_contributions`, `loan_repayments`, `colectas`, `compromisos_colecta`, `votes`).",
        "",
        "---",
        "",
        "## 1. Resumen Comparativo General",
        "",
        "| Métrica | Producción (`mutualfam-backend`) | QA (`mutualfam-qa-backend`) | Total Consolidado |",
        "| :--- | :---: | :---: | :---: |",
        f"| **Total de eventos de usuario** | {stats_prod['total_eventos']} | {stats_qa['total_eventos']} | {stats_prod['total_eventos'] + stats_qa['total_eventos']} |",
        f"| **Días con actividad real** | {stats_prod['dias_activos']} | {stats_qa['dias_activos']} | {len(set(stats_prod['por_fecha'].keys()).union(set(stats_qa['por_fecha'].keys())))} |",
        f"| **Rango de fechas observado** | {stats_prod.get('primera_fecha','N/A')[:10]} al {stats_prod.get('ultima_fecha','N/A')[:10]} | {stats_qa.get('primera_fecha','N/A')[:10]} al {stats_qa.get('ultima_fecha','N/A')[:10]} | {min(stats_prod.get('primera_fecha','9999')[:10], stats_qa.get('primera_fecha','9999')[:10])} al {max(stats_prod.get('ultima_fecha','0000')[:10], stats_qa.get('ultima_fecha','0000')[:10])} |",
        f"| **Promedio diario (días activos)** | **{stats_prod['promedio_diario_dias_activos']:.2f} ev/día** | **{stats_qa['promedio_diario_dias_activos']:.2f} ev/día** | **{(stats_prod['total_eventos'] + stats_qa['total_eventos']) / max(1, stats_prod['dias_activos'] + stats_qa['dias_activos']):.2f} ev/día** |",
        "",
        "---",
        "",
        "## 2. Promedios por Día de la Semana",
        "",
        "| Día de la Semana | Producción (Eventos) | Producción (% / Promedio) | QA (Eventos) | QA (% / Promedio) |",
        "| :--- | :---: | :---: | :---: | :---: |",
    ]

    for dia in DIAS_SEMANA_ES:
        dp = stats_prod["por_dia_semana"][dia]
        dq = stats_qa["por_dia_semana"][dia]
        lines.append(
            f"| **{dia}** | {dp['conteo']} | {dp['porcentaje']:.1f}% ({dp['promedio']:.2f}/día) | {dq['conteo']} | {dq['porcentaje']:.1f}% ({dq['promedio']:.2f}/día) |"
        )

    lines.extend([
        "",
        "---",
        "",
        "## 3. Distribución por Día del Mes",
        "",
        "| Día del Mes | Eventos Producción | % Prod | Eventos QA | % QA |",
        "| :---: | :---: | :---: | :---: | :---: |",
    ])

    todos_los_dias = sorted(set(
        [d for d, v in stats_prod["por_dia_mes"].items() if v["conteo"] > 0] +
        [d for d, v in stats_qa["por_dia_mes"].items() if v["conteo"] > 0]
    ))
    for d in todos_los_dias:
        dp = stats_prod["por_dia_mes"][d]
        dq = stats_qa["por_dia_mes"][d]
        lines.append(
            f"| Día {d:02d} | {dp['conteo']} | {dp['porcentaje']:.1f}% | {dq['conteo']} | {dq['porcentaje']:.1f}% |"
        )

    lines.extend([
        "",
        "---",
        "",
        "## 4. Distribución por Hora del Día (VET, UTC-4)",
        "",
        "| Franja Horaria | Producción | % Prod | QA | % QA | Franja General |",
        "| :--- | :---: | :---: | :---: | :---: | :--- |",
    ])

    for h in range(24):
        dp = stats_prod["por_hora"][h]
        dq = stats_qa["por_hora"][h]
        if dp["conteo"] > 0 or dq["conteo"] > 0:
            nom_f = next((n for n, rng in FRANJAS_HORARIAS.items() if h in rng), "")
            lines.append(
                f"| `{dp['hora']}` | {dp['conteo']} | {dp['porcentaje']:.1f}% | {dq['conteo']} | {dq['porcentaje']:.1f}% | {nom_f} |"
            )

    lines.extend([
        "",
        "---",
        "",
        "## 5. Distribución por Módulo Funcional",
        "",
        "### Producción:",
    ])
    for mod, cnt in stats_prod["por_modulo"].items():
        pct = (cnt / stats_prod["total_eventos"]) * 100 if stats_prod["total_eventos"] > 0 else 0
        lines.append(f"- **{mod}**: {cnt} eventos ({pct:.1f}%)")

    lines.extend([
        "",
        "### QA:",
    ])
    for mod, cnt in stats_qa["por_modulo"].items():
        pct = (cnt / stats_qa["total_eventos"]) * 100 if stats_qa["total_eventos"] > 0 else 0
        lines.append(f"- **{mod}**: {cnt} eventos ({pct:.1f}%)")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"✔ Informe Markdown exportado en: {md_path}")


def main():
    parser = argparse.ArgumentParser(description="Análisis de frecuencias de uso en base de datos MutualFam.")
    parser.add_argument("--env", choices=["all", "qa", "prod"], default="all", help="Entorno a analizar")
    parser.add_argument("--qa", default=None, help="Ruta al archivo SQLite de QA")
    parser.add_argument("--prod", default=None, help="Ruta al archivo SQLite de Producción")
    parser.add_argument("--fetch", action="store_true", help="Descargar BDs frescas vía Fly.io")
    parser.add_argument("--json", default=None, help="Ruta para exportar resultados en JSON")
    parser.add_argument("--markdown", default=None, help="Ruta para exportar informe en Markdown")

    args = parser.parse_args()

    # Raíz del proyecto
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))

    # Rutas por defecto en backups/
    qa_db = args.qa or os.path.join(project_root, "backups", "mutualfam-qa-backend_latest.db")
    prod_db = args.prod or os.path.join(project_root, "backups", "mutualfam-backend_latest.db")

    if args.fetch:
        if args.env in ("all", "qa"):
            fetch_database_from_fly("qa", project_root)
        if args.env in ("all", "prod"):
            fetch_database_from_fly("prod", project_root)

    results = {}

    stats_qa = None
    stats_prod = None

    if args.env in ("all", "qa"):
        events_qa, err_qa = extract_events_from_db(qa_db)
        if err_qa:
            print(f"❌ Error en BD QA ({qa_db}): {err_qa}")
        else:
            stats_qa = analyze_events(events_qa)
            results["qa"] = stats_qa
            print_env_report("QA", stats_qa, events_qa)

    if args.env in ("all", "prod"):
        events_prod, err_prod = extract_events_from_db(prod_db)
        if err_prod:
            print(f"❌ Error en BD Producción ({prod_db}): {err_prod}")
        else:
            stats_prod = analyze_events(events_prod)
            results["produccion"] = stats_prod
            print_env_report("PRODUCCIÓN", stats_prod, events_prod)

    if args.env == "all" and stats_qa and stats_prod:
        print_comparison_table(stats_qa, stats_prod)

    if args.json:
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"✔ Resultados exportados en JSON: {args.json}")

    if args.markdown and stats_qa and stats_prod:
        generate_markdown_report(stats_qa, stats_prod, args.markdown)


if __name__ == "__main__":
    main()

