import os
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session
from civiccore.modules.membership.models import Organization, OrganizationMembership, MemberStatus, User
from civiccore.modules.governance.models import Proposal, ProposalStatus
from civiccore.core.config import is_qa_environment
from models import ProposalRateLimit, utcnow

# Overrides en memoria para entorno de pruebas/QA
_runtime_overrides = {}

def set_limit_override(key: str, value):
    """Establece una sobreescritura temporal de configuración de límites (para QA)."""
    _runtime_overrides[key] = value

def reset_limit_overrides():
    """Restaura los límites a sus valores predeterminados / variables de entorno."""
    _runtime_overrides.clear()

def get_max_members_per_mutual() -> int:
    """Máximo número de miembros activos permitidos por mutual."""
    if "max_members_per_mutual" in _runtime_overrides:
        return int(_runtime_overrides["max_members_per_mutual"])
    return int(os.getenv("LIMIT_MAX_MEMBERS_PER_MUTUAL", "15"))

def get_max_extra_mutuals_first_mutual() -> int:
    """Máximo número de mutuales adicionales que puede crear un miembro de la primera mutual."""
    if "extra_mutuals_first_mutual" in _runtime_overrides:
        return int(_runtime_overrides["extra_mutuals_first_mutual"])
    return int(os.getenv("LIMIT_EXTRA_MUTUALS_FIRST_MUTUAL", "1"))

def get_contact_email() -> str:
    """Correo electrónico oficial para solicitar asistencia o entornos independientes."""
    if "contact_email" in _runtime_overrides:
        return str(_runtime_overrides["contact_email"])
    return os.getenv("LIMIT_CONTACT_EMAIL", "mutualfam@gmail.com")

def get_is_beta() -> bool:
    """Indica si la aplicación se encuentra en fase Beta o Versión Estable."""
    if "is_beta" in _runtime_overrides:
        return bool(_runtime_overrides["is_beta"])
    # Por defecto true durante la fase de validación con usuarios reales
    return os.getenv("APP_IS_BETA", "true").lower() in ("true", "1", "yes", "t")

def get_app_phase_summary() -> dict:
    """Retorna la información y directivas de la fase actual del producto (Beta vs Estable)."""
    is_beta = get_is_beta()
    return {
        "is_beta": is_beta,
        "phase_label": "Beta" if is_beta else "Estable",
        "welcome_title": "¡Bienvenido a la Versión Beta!",
        "welcome_message": (
            "Estás utilizando la versión preliminar de Mutual Familiar. Gracias por ser parte "
            "del grupo de familias pioneras que nos ayuda a validar la plataforma con su uso y sugerencias."
        ),
        "support_email": get_contact_email(),
    }

def get_limits_summary() -> dict:
    """Retorna el resumen de configuración de límites actual."""
    return {
        "max_members_per_mutual": get_max_members_per_mutual(),
        "extra_mutuals_first_mutual": get_max_extra_mutuals_first_mutual(),
        "proposal_base_cooldown_seconds": get_proposal_base_cooldown_seconds(),
        "max_active_proposals_per_member": get_max_active_proposals_per_member(),
        "contact_email": get_contact_email(),
        "is_beta": get_is_beta(),
    }

def check_can_create_organization(db: Session, user: User):
    """
    Regla 1:
    - Si no existe ninguna mutual en el sistema, se permite crear la primera (bootstrap inicial).
    - Si ya existe al menos una mutual:
      * Solo los miembros activos de la primera mutual (la de menor id) pueden crear una nueva mutual.
      * Cada miembro de la primera mutual puede crear como máximo 1 mutual adicional (o el valor de extra_mutuals_first_mutual).
      * Los usuarios que no pertenezcan a la primera mutual no pueden crear ninguna.
    """
    first_org = db.query(Organization).order_by(Organization.id.asc()).first()
    if first_org is None:
        # Bootstrap: no existe ninguna organización aún
        return

    contact_email = get_contact_email()

    # Verificar si el usuario es miembro activo de la primera mutual
    is_member_of_first = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == first_org.id,
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.status == MemberStatus.ACTIVE
    ).first() is not None

    if not is_member_of_first:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "LIMIT_MUTUALS",
                "message": (
                    f"Solo los miembros de la primera mutual pueden crear una nueva mutual en esta instancia. "
                    f"Si deseas crear tu propia mutual o necesitas asistencia técnica para montar tu propio "
                    f"entorno independiente (backend, bot de Telegram o repositorio), escríbenos a {contact_email}."
                ),
                "contact_email": contact_email
            }
        )

    # El usuario pertenece a la primera mutual. Verificar cuántas mutuales adicionales ha creado
    max_extra = get_max_extra_mutuals_first_mutual()
    created_extra_count = db.query(Organization).filter(
        Organization.founder_user_id == user.id,
        Organization.id != first_org.id
    ).count()

    if created_extra_count >= max_extra:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "LIMIT_MUTUALS",
                "message": (
                    f"Has alcanzado el límite permitido de mutuales adicionales creadas ({max_extra}). "
                    f"Si tu organización o grupo familiar requiere desplegar más mutuales o contar con su propia "
                    f"infraestructura independiente (backend, bot de Telegram o repositorio propio), comunícate por email a {contact_email}."
                ),
                "contact_email": contact_email,
                "max_extra": max_extra,
                "created_extra": created_extra_count
            }
        )

def check_can_join_organization(db: Session, org_id: int):
    """
    Regla 2:
    - Limita el número de miembros activos por mutual al umbral configurado (15 en producción).
    """
    max_members = get_max_members_per_mutual()
    active_count = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org_id,
        OrganizationMembership.status == MemberStatus.ACTIVE
    ).count()

    if active_count >= max_members:
        contact_email = get_contact_email()
        org = db.query(Organization).filter(Organization.id == org_id).first()
        org_name = org.name if org else "esta mutual"
        raise HTTPException(
            status_code=409,
            detail={
                "code": "LIMIT_MEMBERS",
                "message": (
                    f"La mutual '{org_name}' ha alcanzado su capacidad máxima permitida de {max_members} miembros. "
                    f"Para solicitar asistencia técnica para tu grupo u organización para ampliar capacidad o montar "
                    f"un entorno independiente (backend, bot de Telegram o repositorio), contáctanos a {contact_email}."
                ),
                "contact_email": contact_email,
                "max_members": max_members,
                "current_members": active_count,
                "organization_name": org_name
            }
        )

def check_can_create_invite(db: Session, org_id: int):
    """
    Verifica que la mutual no esté en su cupo máximo antes de permitir generar una nueva invitación.
    """
    max_members = get_max_members_per_mutual()
    active_count = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org_id,
        OrganizationMembership.status == MemberStatus.ACTIVE
    ).count()

    if active_count >= max_members:
        contact_email = get_contact_email()
        org = db.query(Organization).filter(Organization.id == org_id).first()
        org_name = org.name if org else "esta mutual"
        raise HTTPException(
            status_code=409,
            detail={
                "code": "LIMIT_MEMBERS",
                "message": (
                    f"La mutual '{org_name}' ya cuenta con el número máximo de {max_members} miembros permitidos. "
                    f"No es posible emitir más invitaciones. Si requieres asistencia técnica para tu grupo, "
                    f"comunícate a {contact_email}."
                ),
                "contact_email": contact_email,
                "max_members": max_members,
                "current_members": active_count,
                "organization_name": org_name
            }
        )


def format_remaining_time(seconds: int) -> str:
    """Formatea segundos restantes a una cadena legible en español."""
    if seconds <= 0:
        return "0 segundos"

    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    parts = []
    if days > 0:
        parts.append(f"{days} {'día' if days == 1 else 'días'}")
    if hours > 0:
        parts.append(f"{hours} {'hora' if hours == 1 else 'horas'}")
    if minutes > 0 and days == 0:
        parts.append(f"{minutes} {'minuto' if minutes == 1 else 'minutos'}")
    if secs > 0 and days == 0 and hours == 0:
        parts.append(f"{secs} {'segundo' if secs == 1 else 'segundos'}")

    if not parts:
        return "1 segundo"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} y {parts[1]}"


def get_proposal_base_cooldown_seconds(is_qa: Optional[bool] = None) -> int:
    """Retorna el tiempo base de enfriamiento en segundos entre propuestas de un mismo miembro."""
    if "proposal_base_cooldown_seconds" in _runtime_overrides:
        return int(_runtime_overrides["proposal_base_cooldown_seconds"])
    qa = is_qa if is_qa is not None else is_qa_environment()
    if qa:
        return int(os.getenv("QA_PROPOSAL_COOLDOWN_SECONDS", "120"))  # 2 minutos en QA
    return int(os.getenv("PROPOSAL_COOLDOWN_SECONDS", "86400"))  # 24 horas en Producción


def get_max_active_proposals_per_member() -> int:
    """Máximo número de propuestas activas simultáneas en debate/votación que un miembro puede tener."""
    if "max_active_proposals_per_member" in _runtime_overrides:
        return int(_runtime_overrides["max_active_proposals_per_member"])
    return int(os.getenv("MAX_ACTIVE_PROPOSALS_PER_MEMBER", "1"))


def check_can_create_proposal(
    db: Session,
    user_id: int,
    org_id: int,
    x_bypass_rate_limit: Optional[str] = None
) -> ProposalRateLimit:
    """
    Regla 3 (Gobernanza / Asamblea):
    Protección contra ataques de inundación de propuestas en la asamblea familiar.
    - Límite de propuestas activas simultáneas por miembro (máx 1 activa por autor).
    - Período de enfriamiento (cooldown) tras emitir una propuesta (24h prod / 2min QA).
    - Ampliación progresiva (Exponential Backoff): Si se detectan intentos repetidos durante el bloqueo,
      el tiempo de espera se duplica sucesivamente por cada strike detectado.
    """
    bypass = (
        _runtime_overrides.get("bypass_proposal_rate_limit")
        or (x_bypass_rate_limit and str(x_bypass_rate_limit).lower() in ("true", "1", "yes"))
    )
    now = utcnow()
    qa = is_qa_environment()
    base_cooldown = get_proposal_base_cooldown_seconds(qa)
    max_active = get_max_active_proposals_per_member()

    # 1. Obtener o crear registro de tasa de propuestas
    throttle = db.query(ProposalRateLimit).filter(
        ProposalRateLimit.organization_id == org_id,
        ProposalRateLimit.user_id == user_id
    ).first()

    if not throttle:
        throttle = ProposalRateLimit(
            organization_id=org_id,
            user_id=user_id,
            penalty_level=0,
            failed_attempts_count=0,
            last_attempt_at=now
        )
        db.add(throttle)
        db.commit()
        db.refresh(throttle)

    if bypass:
        return throttle

    # 2. Verificar si está en período de enfriamiento / bloqueo activo
    if throttle.blocked_until:
        blocked_until = throttle.blocked_until
        if blocked_until.tzinfo is None:
            blocked_until = blocked_until.replace(tzinfo=timezone.utc)

        if now < blocked_until:
            # ATAQUE O INTENTO DE INUNDACIÓN DETECTADO (Intento durante cooldown)
            throttle.failed_attempts_count = (throttle.failed_attempts_count or 0) + 1
            throttle.last_attempt_at = now

            # Si insiste mientras está bloqueado, ampliar progresivamente el cooldown
            throttle.penalty_level = min((throttle.penalty_level or 0) + 1, 5) # Niveles 1 a 5 (2x, 4x, 8x, 16x, 32x)
            multiplier = 2 ** throttle.penalty_level
            penalty_seconds = base_cooldown * multiplier

            # Tope máximo de penalización (7 días en prod, 15 minutos en QA)
            max_cap = 604800 if not qa else 900
            penalty_seconds = min(penalty_seconds, max_cap)

            throttle.blocked_until = now + timedelta(seconds=penalty_seconds)
            db.commit()

            remaining_text = format_remaining_time(penalty_seconds)
            raise HTTPException(
                status_code=429,
                detail=(
                    f"🚫 Límite de propuestas alcanzado: Debes esperar {remaining_text} para presentar otra propuesta ante la asamblea familiar. "
                    f"⚠️ Protección contra inundación de propuestas: El tiempo de espera se ha ampliado progresivamente a nivel {throttle.penalty_level} "
                    f"debido a intentos reiterados de publicación."
                )
            )

    # 3. Verificar límite de propuestas activas simultáneas en curso por el autor
    active_props = db.query(Proposal).filter(
        Proposal.organization_id == org_id,
        Proposal.author_id == user_id,
        Proposal.status.in_([ProposalStatus.DEBATE, ProposalStatus.VOTING])
    ).all()

    if len(active_props) >= max_active:
        active_title = active_props[0].title if active_props else "Propuesta activa"
        raise HTTPException(
            status_code=429,
            detail=(
                f"⚠️ Límite de propuestas activas alcanzado: Ya tienes una propuesta en deliberación abierta en la asamblea familiar "
                f"('{active_title}'). Para mantener el orden y evitar la saturación de la asamblea, debes esperar a que concluya "
                f"antes de presentar una nueva."
            )
        )

    return throttle


def record_proposal_created(
    db: Session,
    throttle: ProposalRateLimit,
    x_bypass: bool = False
):
    """
    Registra exitosamente la creación de una propuesta y activa el enfriamiento base.
    Si el miembro mantuvo buen comportamiento y el bloqueo previo expiró limpiamente,
    reduce progresivamente el nivel de penalización hacia cero.
    """
    if x_bypass:
        return

    now = utcnow()
    base_cooldown = get_proposal_base_cooldown_seconds()

    # Si transcurrió mucho tiempo desde el último bloqueo sin incidencias, restablecer penalización
    if throttle.blocked_until:
        blocked_until = throttle.blocked_until
        if blocked_until.tzinfo is None:
            blocked_until = blocked_until.replace(tzinfo=timezone.utc)
        if (now - blocked_until).total_seconds() > (base_cooldown * 2):
            throttle.penalty_level = max(0, (throttle.penalty_level or 0) - 1)

    cooldown_seconds = base_cooldown * (2 ** (throttle.penalty_level or 0))
    max_cap = 604800 if not is_qa_environment() else 900
    cooldown_seconds = min(cooldown_seconds, max_cap)

    throttle.last_proposal_at = now
    throttle.failed_attempts_count = 0
    throttle.total_proposals_created = (throttle.total_proposals_created or 0) + 1
    throttle.blocked_until = now + timedelta(seconds=cooldown_seconds)
    db.commit()


def get_proposal_throttle_status(db: Session, user_id: int, org_id: int) -> dict:
    """
    Retorna el estado de enfriamiento y capacidad de proponer de un miembro para la UI.
    """
    now = utcnow()
    qa = is_qa_environment()
    base_cooldown = get_proposal_base_cooldown_seconds(qa)
    max_active = get_max_active_proposals_per_member()

    active_props = db.query(Proposal).filter(
        Proposal.organization_id == org_id,
        Proposal.author_id == user_id,
        Proposal.status.in_([ProposalStatus.DEBATE, ProposalStatus.VOTING])
    ).all()

    active_count = len(active_props)

    throttle = db.query(ProposalRateLimit).filter(
        ProposalRateLimit.organization_id == org_id,
        ProposalRateLimit.user_id == user_id
    ).first()

    blocked_until = None
    remaining_seconds = 0
    is_time_blocked = False
    penalty_level = throttle.penalty_level if throttle else 0

    if throttle and throttle.blocked_until:
        bu = throttle.blocked_until
        if bu.tzinfo is None:
            bu = bu.replace(tzinfo=timezone.utc)
        if now < bu:
            is_time_blocked = True
            remaining_seconds = max(0, int((bu - now).total_seconds()))
            blocked_until = bu.isoformat()

    has_active_limit = active_count >= max_active
    can_propose = not is_time_blocked and not has_active_limit

    reason = None
    if is_time_blocked:
        rem_text = format_remaining_time(remaining_seconds)
        reason = f"Debes esperar {rem_text} para presentar otra propuesta ante la asamblea (Protección anti-saturación nivel {penalty_level})."
    elif has_active_limit:
        active_title = active_props[0].title if active_props else "Propuesta"
        reason = f"Ya tienes una propuesta en deliberación abierta ('{active_title}'). Debes esperar su resolución."

    return {
        "can_propose": can_propose,
        "is_time_blocked": is_time_blocked,
        "has_active_limit": has_active_limit,
        "active_proposals_count": active_count,
        "max_active_proposals": max_active,
        "remaining_seconds": remaining_seconds,
        "remaining_text": format_remaining_time(remaining_seconds) if remaining_seconds > 0 else "0 segundos",
        "penalty_level": penalty_level,
        "blocked_until": blocked_until,
        "reason": reason
    }

