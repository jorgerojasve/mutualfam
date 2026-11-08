import logging
from datetime import datetime, timezone, timedelta, time
from models import Colecta, EstadoColecta, CompromisoColecta, EstadoCompromiso
from services.notifications import notify_users
from services.telegram_bot import send_telegram_notification
from services import tasa_cambio

logger = logging.getLogger(__name__)

CARACAS_TZ = timezone(timedelta(hours=-4))


def parse_hora_pago(hora_str: str) -> time:
    """Parsea una cadena 'HH:MM' a un objeto time. Por defecto 12:00."""
    if not hora_str:
        return time(12, 0)
    try:
        parts = hora_str.strip().split(':')
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        return time(h, m)
    except Exception:
        return time(12, 0)


def check_and_send_colectas_reminders(db, force: bool = False) -> dict:
    """
    Evalúa todas las colectas activas o en propuesta y envía recordatorios automáticos:
    1. Notificación el día antes de la ejecución (indicando que deben pagar el día siguiente).
    2. Notificación el mismo día a las 8:00 am, a menos que la hora de pago/liquidación
       sea antes de las 9:00 am, en cuyo caso se notifica una hora antes.
    """
    now_ve = datetime.now(CARACAS_TZ)
    today_ve = now_ve.date()
    current_time_ve = now_ve.time()

    # Colectas que no estén cerradas, completadas ni canceladas
    colectas = db.query(Colecta).filter(
        Colecta.estado.in_([EstadoColecta.ACTIVA, EstadoColecta.PROPUESTA])
    ).all()

    sent_day_before = 0
    sent_same_day = 0

    for c in colectas:
        if not c.fecha_pago:
            continue

        # Obtener compromisos pendientes (no validados, no pagados, no cancelados)
        pending_comps = [
            comp for comp in c.compromisos
            if comp.estado in [EstadoCompromiso.PROMETIDO, EstadoCompromiso.NOTIFICADO]
        ]
        if not pending_comps:
            continue

        hora_pago_time = parse_hora_pago(c.hora_pago)
        hora_display = c.hora_pago or "12:00"

        # ----------------------------------------------------
        # 1. NOTIFICACIÓN D-1 (El día antes de la fecha de pago)
        # ----------------------------------------------------
        diff_days = (c.fecha_pago - today_ve).days
        if (diff_days == 1 or force) and (not c.recordatorio_previo_enviado or force):
            user_ids = list({comp.socio_id for comp in pending_comps})
            title = f"⏰ Mañana es el día de pago: {c.titulo}"
            body = (
                f"Hola, mañana {c.fecha_pago.strftime('%d/%m/%Y')} a las {hora_display} es el momento "
                f"de pago y liquidación de '{c.titulo}'. Recuerda que si pagas en Bolívares se calculará con la tasa del día."
            )
            notify_users(db, user_ids, title, body, data={"colecta_id": c.id, "tipo": "recordatorio_previo"})
            c.recordatorio_previo_enviado = True
            sent_day_before += len(user_ids)
            logger.info(f"Recordatorio D-1 enviado para colecta {c.id} a {len(user_ids)} socios")

        # ----------------------------------------------------
        # 2. NOTIFICACIÓN D-0 (El mismo día de la fecha de pago)
        # ----------------------------------------------------
        elif (diff_days == 0 or force) and (not c.recordatorio_mismo_dia_enviado or force):
            # Regla: 8:00 am, a menos que la hora de pago sea antes de las 9:00 am (en cuyo caso 1 hora antes)
            if hora_pago_time.hour < 9:
                target_hour = max(0, hora_pago_time.hour - 1)
                target_time = time(target_hour, hora_pago_time.minute)
            else:
                target_time = time(8, 0)

            if current_time_ve >= target_time or force:
                tasa_tipo_str = c.tipo_tasa.value if hasattr(c.tipo_tasa, "value") else str(c.tipo_tasa)
                rate_hoy = tasa_cambio.get_rate(tasa_tipo_str, c.tasa_fija_valor)
                now_utc = datetime.now(timezone.utc)

                for comp in pending_comps:
                    comp.tasa_usada = rate_hoy
                    comp.tipo_tasa_usada = tasa_tipo_str
                    comp.monto_bs = round(comp.monto_usd * rate_hoy, 2)
                    comp.estado = EstadoCompromiso.NOTIFICADO
                    comp.fecha_notificacion = now_utc

                    title = f"💵 ¡Hoy es el día de pago!: {c.titulo}"
                    body = (
                        f"Hoy es la liquidación ({hora_display}) de '{c.titulo}'. Tu aporte de "
                        f"${comp.monto_usd:,.2f} USD equivale a Bs {comp.monto_bs:,.2f} (Tasa {tasa_tipo_str.upper()}: {rate_hoy:,.2f}). "
                        f"Por favor realiza tu pago y adjunta el comprobante."
                    )
                    notify_users(db, [comp.socio_id], title, body, data={"colecta_id": c.id, "tipo": "recordatorio_mismo_dia"})

                c.recordatorio_mismo_dia_enviado = True
                sent_same_day += len(pending_comps)
                logger.info(f"Recordatorio D-0 enviado para colecta {c.id} a {len(pending_comps)} socios")

    if sent_day_before > 0 or sent_same_day > 0:
        db.commit()

    return {"sent_day_before": sent_day_before, "sent_same_day": sent_same_day}
