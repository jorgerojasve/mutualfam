import os
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from civiccore.modules.membership.models import Organization, OrganizationMembership, MemberStatus, User

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

def get_limits_summary() -> dict:
    """Retorna el resumen de configuración de límites actual."""
    return {
        "max_members_per_mutual": get_max_members_per_mutual(),
        "extra_mutuals_first_mutual": get_max_extra_mutuals_first_mutual(),
        "contact_email": get_contact_email(),
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
