import logging
from datetime import datetime, timezone, date
from sqlalchemy import text
from models import LoanRequest, LoanStatus, LoanContribution, ContributionStatus
from services.notifications import notify_users

logger = logging.getLogger(__name__)

def ensure_reminder_column_exists(engine):
    """Garantiza de forma segura que las columnas de recordatorios y rechazos existan en SQLite/PostgreSQL."""
    columns_to_add = [
        ("loan_requests", "last_repayment_reminder_date", "DATE"),
        ("loan_contributions", "rejection_reason", "TEXT"),
        ("loan_contributions", "rejection_date", "DATETIME"),
        ("loan_repayments", "rejection_reason", "TEXT"),
        ("loan_repayments", "rejected_at", "DATETIME"),
    ]
    for table, col, col_type in columns_to_add:
        try:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
                logger.info(f"Columna {col} agregada a {table}")
        except Exception:
            pass

def format_ve_amount(amount: float) -> str:
    """Formatea un monto al estándar venezolano $ 1.250,50"""
    try:
        fixed = f"{float(amount):.2f}"
        int_part, dec_part = fixed.split('.')
        with_dots = ""
        for i, c in enumerate(reversed(int_part)):
            if i > 0 and i % 3 == 0:
                with_dots = "." + with_dots
            with_dots = c + with_dots
        return f"${with_dots},{dec_part}"
    except Exception:
        return f"${amount}"

def auto_verify_pending_repayments(db) -> int:
    """
    CR-03: Auto-valida devoluciones notificadas (PAID) tras 7 días continuos de inacción del acreedor.
    Evita que el prestatario quede insolvente indefinidamente por ghosting del acreedor.
    """
    from datetime import datetime, timezone, timedelta
    from models import LoanRepayment, RepaymentStatus, LoanContribution, ContributionStatus, LoanRequest, LoanStatus
    from sqlalchemy import func
    from services.telegram_bot import send_telegram_notification
    from services.realtime import notify_org

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    stale_repayments = db.query(LoanRepayment).filter(
        LoanRepayment.status == RepaymentStatus.PAID,
        LoanRepayment.created_at <= seven_days_ago
    ).all()

    auto_verified_count = 0
    now_dt = datetime.now(timezone.utc)

    for repay in stale_repayments:
        contrib = db.query(LoanContribution).filter(LoanContribution.id == repay.contribution_id).first()
        if not contrib:
            continue

        repay.status = RepaymentStatus.VERIFIED
        repay.verified_at = now_dt
        db.flush()

        # Recalcular si se cubrió el total de la contribución
        total_verified = db.query(func.sum(LoanRepayment.amount_usd)).filter(
            LoanRepayment.contribution_id == contrib.id,
            LoanRepayment.status == RepaymentStatus.VERIFIED
        ).scalar() or 0.0

        if total_verified >= (contrib.amount_usd - 0.05):
            contrib.status = ContributionStatus.REPAID
        else:
            pending_repay = db.query(LoanRepayment).filter(
                LoanRepayment.contribution_id == contrib.id,
                LoanRepayment.status == RepaymentStatus.PAID
            ).first()
            if not pending_repay:
                contrib.status = ContributionStatus.VERIFIED
            else:
                contrib.status = ContributionStatus.REPAY_NOTIFIED

        loan = db.query(LoanRequest).filter(LoanRequest.id == contrib.loan_request_id).first()
        if loan:
            all_contribs = db.query(LoanContribution).filter(
                LoanContribution.loan_request_id == loan.id,
                LoanContribution.status != ContributionStatus.REJECTED
            ).all()

            all_repaid = len(all_contribs) > 0 and all(c.status == ContributionStatus.REPAID for c in all_contribs)
            if all_repaid:
                loan.status = LoanStatus.REPAID
                loan.repaid_at = now_dt

            msg = (
                f"⏰ <b>Devolución Auto-Verificada por Inacción</b>\n\n"
                f"La devolución de <b>${repay.amount_usd}</b> en el préstamo de {loan.motive} "
                f"ha sido auto-verificada tras 7 días continuos sin objeción del acreedor."
            )
            send_telegram_notification(msg)
            notify_users(
                db,
                [loan.requester_id, contrib.funder_id],
                "Devolución auto-verificada",
                f"La devolución de ${repay.amount_usd} fue auto-verificada por el sistema tras 7 días de inacción.",
                data={"screen": "Loans", "loan_id": loan.id, "type": "auto_verified"}
            )
            notify_org(loan.organization_id, "LOANS_CHANGED", {"loan_id": loan.id})

        auto_verified_count += 1

    if auto_verified_count > 0:
        db.commit()

    return auto_verified_count

def check_and_send_repayment_reminders(db, force: bool = False) -> dict:
    """
    Evalúa todos los préstamos activos y envía recordatorios push según la cadencia aprobada:
    - D-3: 3 días antes de la fecha estimada
    - D-1: 1 día antes de la fecha estimada
    - D-0: El mismo día del vencimiento
    - D+2: 2 días después del vencimiento
    - D+3+: Diario después del vencimiento hasta que sea saldado
    """
    today = datetime.now(timezone.utc).date()
    auto_verified_count = auto_verify_pending_repayments(db)
    
    # Préstamos no saldados ni cancelados que tengan fecha estimada
    loans = db.query(LoanRequest).filter(
        LoanRequest.estimated_repayment_date.isnot(None),
        LoanRequest.status.notin_([LoanStatus.REPAID, LoanStatus.CANCELLED])
    ).all()

    sent_count = 0
    evaluated_count = len(loans)

    for loan in loans:
        # Verificar que el préstamo haya recibido fondos reales (o esté financiado)
        verified_contribs = db.query(LoanContribution).filter(
            LoanContribution.loan_request_id == loan.id,
            LoanContribution.status.in_([
                ContributionStatus.PAID,
                ContributionStatus.VERIFIED,
                ContributionStatus.REPAY_NOTIFIED
            ])
        ).all()

        if not verified_contribs and loan.status != LoanStatus.FUNDED:
            # Préstamo en espera de fondos: no se exige devolución si no se le ha entregado dinero
            continue

        # Evitar más de un recordatorio el mismo día para el mismo préstamo (a menos que se fuerce para pruebas)
        if not force and loan.last_repayment_reminder_date == today:
            continue

        # Diferencia de días: (hoy - fecha_estimada)
        # diff < 0: antes de la fecha (ej. -3 => faltan 3 días)
        # diff == 0: hoy vence
        # diff > 0: vencido (ej. 2 => pasaron 2 días)
        diff_days = (today - loan.estimated_repayment_date).days

        title = None
        body = None
        formatted_date = loan.estimated_repayment_date.strftime("%d/%m/%Y")
        formatted_amount = format_ve_amount(loan.amount_usd)

        # Obtener nombre del prestatario
        requester_name = "familiar"
        try:
            from civiccore.modules.membership.models import User
            user = db.query(User).filter(User.id == loan.requester_id).first()
            if user and user.first_name:
                requester_name = user.first_name.strip()
        except Exception:
            pass

        if diff_days == -3:
            # 3 días antes
            title = "🗓️ Recordatorio de Préstamo"
            body = f"Hola {requester_name}, en 3 días ({formatted_date}) es la fecha estimada para devolver tu préstamo de {formatted_amount}. ¡Gracias por mantener fuerte tu mutual!"
        elif diff_days == -1:
            # 1 día antes
            title = "⏰ Mañana vence tu fecha estimada"
            body = f"Hola {requester_name}, mañana ({formatted_date}) es la fecha estimada para devolver tu préstamo de {formatted_amount}. Toca para revisar los datos de pago."
        elif diff_days == 0:
            # El mismo día
            title = "🔔 Hoy es la fecha de devolución"
            body = f"Hola {requester_name}, hoy ({formatted_date}) se cumple la fecha estimada de devolución de tu préstamo de {formatted_amount}. Toca aquí para registrar tu pago."
        elif diff_days == 2:
            # 2 días después
            title = "💬 Préstamo pendiente"
            body = f"Hola {requester_name}, la fecha estimada de tu préstamo de {formatted_amount} fue hace 2 días ({formatted_date}). Recuerda registrar tu devolución en la app."
        elif diff_days >= 3:
            # Diario a partir del día 3 de retraso
            title = "⚠️ Préstamo pendiente"
            body = f"Hola {requester_name}, tu préstamo de {formatted_amount} tiene {diff_days} días de vencimiento. Recuerda registrar tu abono o devolución en la app."

        if title and body:
            print(f"📤 [RECORDATORIO PRÉSTAMO] ID={loan.id} | Prestatario={loan.requester_id} | Hito diff_days={diff_days}", flush=True)
            notify_users(
                db, 
                [loan.requester_id], 
                title, 
                body, 
                data={"screen": "Loans", "loan_id": loan.id, "type": "repayment_reminder"}
            )
            loan.last_repayment_reminder_date = today
            db.commit()
            sent_count += 1

    return {
        "status": "ok",
        "evaluated_loans": evaluated_count,
        "reminders_sent": sent_count,
        "auto_verified_repayments": auto_verified_count,
        "date": str(today)
    }
