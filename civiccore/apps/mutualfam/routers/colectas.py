from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import date, datetime, timezone
import json

from civiccore.core.database import get_db
from civiccore.modules.membership.models import User, OrganizationMembership
from models import (
    Colecta,
    CompromisoColecta,
    EstadoColecta,
    TipoTasaColecta,
    EstadoCompromiso,
    UserPaymentConfig,
    utcnow
)
from routers.membership import get_current_org_member
from services.telegram_bot import send_telegram_notification
from services.realtime import notify_org
from services.notifications import notify_users
from services import tasa_cambio

router = APIRouter()


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class CreateColectaRequest(BaseModel):
    titulo: str
    proposito: str
    monto_meta_usd: float
    tipo_tasa: str = "bcv"  # bcv, usdt, euro, paralelo, fija
    tasa_fija_valor: Optional[float] = None
    fecha_pago: date
    fecha_limite_aportes: Optional[date] = None
    beneficiario_nombre: Optional[str] = None
    beneficiario_datos_pago: Optional[Dict[str, Any]] = None


class PledgeCommitmentRequest(BaseModel):
    monto_usd: float


class ConfirmPaymentRequest(BaseModel):
    payment_method: Optional[str] = None
    referencia_pago: Optional[str] = None
    comprobante_url: Optional[str] = None
    nota_pago: Optional[str] = None


class ValidateExpenseRequest(BaseModel):
    descripcion_gasto: str
    comprobante_gasto_url: Optional[str] = None  # Opcional


class CompromisoResponse(BaseModel):
    id: int
    socio_id: int
    socio_name: str
    monto_usd: float
    monto_bs: Optional[float] = None
    tasa_usada: Optional[float] = None
    tipo_tasa_usada: Optional[str] = None
    payment_method: Optional[str] = None
    referencia_pago: Optional[str] = None
    comprobante_url: Optional[str] = None
    nota_pago: Optional[str] = None
    estado: str
    fecha_compromiso: datetime
    fecha_notificacion: Optional[datetime] = None
    fecha_pago: Optional[datetime] = None
    fecha_cancelacion: Optional[datetime] = None

    class Config:
        from_attributes = True


class ColectaResponse(BaseModel):
    id: int
    organization_id: int
    proponente_id: int
    proponente_name: str
    titulo: str
    proposito: str
    monto_meta_usd: float
    monto_prometido_usd: float
    monto_recaudado_usd: float
    tipo_tasa: str
    tasa_fija_valor: Optional[float] = None
    tasa_actual: float
    tasa_label: str
    monto_meta_bs: float
    monto_prometido_bs: float
    beneficiario_id: Optional[int] = None
    beneficiario_nombre: Optional[str] = None
    beneficiario_datos_pago: Dict[str, Any] = {}
    gasto_validado: bool = False
    descripcion_gasto: Optional[str] = None
    comprobante_gasto_url: Optional[str] = None
    fecha_pago: date
    fecha_limite_aportes: Optional[date] = None
    estado: str
    created_at: datetime
    is_active: bool
    porcentaje_prometido: float
    porcentaje_recaudado: float
    total_aportantes: int
    mi_compromiso: Optional[CompromisoResponse] = None
    compromisos: List[CompromisoResponse] = []

    class Config:
        from_attributes = True


# ==========================================
# FUNCIONES AUXILIARES DE SERIALIZACIÓN
# ==========================================

def _serialize_compromiso(comp: CompromisoColecta) -> CompromisoResponse:
    socio_name = "Socio"
    if comp.socio:
        socio_name = f"{comp.socio.first_name} {comp.socio.last_name or ''}".strip() or comp.socio.email

    return CompromisoResponse(
        id=comp.id,
        socio_id=comp.socio_id,
        socio_name=socio_name,
        monto_usd=comp.monto_usd,
        monto_bs=comp.monto_bs,
        tasa_usada=comp.tasa_usada,
        tipo_tasa_usada=comp.tipo_tasa_usada,
        payment_method=comp.payment_method,
        referencia_pago=comp.referencia_pago,
        comprobante_url=comp.comprobante_url,
        nota_pago=comp.nota_pago,
        estado=comp.estado.value if hasattr(comp.estado, "value") else str(comp.estado),
        fecha_compromiso=comp.fecha_compromiso,
        fecha_notificacion=comp.fecha_notificacion,
        fecha_pago=comp.fecha_pago,
        fecha_cancelacion=comp.fecha_cancelacion
    )


def _serialize_colecta(colecta: Colecta, current_user_id: int) -> ColectaResponse:
    proponente_name = "Proponente"
    if colecta.proponente:
        proponente_name = f"{colecta.proponente.first_name} {colecta.proponente.last_name or ''}".strip() or colecta.proponente.email

    # Tasa actual y montos en Bs
    tasa_tipo_str = colecta.tipo_tasa.value if hasattr(colecta.tipo_tasa, "value") else str(colecta.tipo_tasa)
    current_rate = tasa_cambio.get_rate(tasa_tipo_str, colecta.tasa_fija_valor)
    tasa_label = tasa_cambio.LABELS.get(tasa_tipo_str, tasa_tipo_str.upper())

    monto_meta_bs = round(colecta.monto_meta_usd * current_rate, 2)
    monto_prometido_bs = round(colecta.monto_prometido_usd * current_rate, 2)

    # Beneficiario y datos de pago
    beneficiario_name = colecta.beneficiario_nombre or proponente_name
    beneficiario_datos = {}
    if colecta.beneficiario_datos_pago:
        try:
            beneficiario_datos = json.loads(colecta.beneficiario_datos_pago)
        except Exception:
            beneficiario_datos = {}

    # Compromisos y aportantes activos
    compromisos_list = []
    mi_compromiso = None
    aportantes_ids = set()

    for comp in colecta.compromisos:
        c_ser = _serialize_compromiso(comp)
        compromisos_list.append(c_ser)
        if comp.estado != EstadoCompromiso.CANCELADO:
            aportantes_ids.add(comp.socio_id)
        if comp.socio_id == current_user_id and comp.estado != EstadoCompromiso.CANCELADO:
            mi_compromiso = c_ser

    # Cálculos porcentuales
    porc_prometido = round((colecta.monto_prometido_usd / colecta.monto_meta_usd * 100), 1) if colecta.monto_meta_usd > 0 else 0.0
    porc_recaudado = round((colecta.monto_recaudado_usd / colecta.monto_meta_usd * 100), 1) if colecta.monto_meta_usd > 0 else 0.0

    estado_str = colecta.estado.value if hasattr(colecta.estado, "value") else str(colecta.estado)
    is_active = (colecta.monto_prometido_usd >= colecta.monto_meta_usd) or (estado_str in ["activa", "cerrada", "completada"])

    return ColectaResponse(
        id=colecta.id,
        organization_id=colecta.organization_id,
        proponente_id=colecta.proponente_id,
        proponente_name=proponente_name,
        titulo=colecta.titulo,
        proposito=colecta.proposito,
        monto_meta_usd=colecta.monto_meta_usd,
        monto_prometido_usd=round(colecta.monto_prometido_usd, 2),
        monto_recaudado_usd=round(colecta.monto_recaudado_usd, 2),
        tipo_tasa=tasa_tipo_str,
        tasa_fija_valor=colecta.tasa_fija_valor,
        tasa_actual=current_rate,
        tasa_label=tasa_label,
        monto_meta_bs=monto_meta_bs,
        monto_prometido_bs=monto_prometido_bs,
        beneficiario_id=colecta.beneficiario_id or colecta.proponente_id,
        beneficiario_nombre=beneficiario_name,
        beneficiario_datos_pago=beneficiario_datos,
        gasto_validado=colecta.gasto_validado,
        descripcion_gasto=colecta.descripcion_gasto,
        comprobante_gasto_url=colecta.comprobante_gasto_url,
        fecha_pago=colecta.fecha_pago,
        fecha_limite_aportes=colecta.fecha_limite_aportes,
        estado=estado_str,
        created_at=colecta.created_at,
        is_active=is_active,
        porcentaje_prometido=porc_prometido,
        porcentaje_recaudado=porc_recaudado,
        total_aportantes=len(aportantes_ids),
        mi_compromiso=mi_compromiso,
        compromisos=compromisos_list
    )


# ==========================================
# ENDPOINTS REST
# ==========================================

@router.get("/tasas", response_model=Dict[str, Any])
def get_available_rates(tasa_fija: Optional[float] = Query(None)):
    """Devuelve las tasas de cambio disponibles con etiquetas y valores actuales."""
    return tasa_cambio.get_all_rates(tasa_fija)


@router.get("/", response_model=List[ColectaResponse])
def get_colectas(
    estado: Optional[str] = None,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """Lista las colectas de la mutual activa con sus tasas calculadas."""
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    query = db.query(Colecta).filter(
        Colecta.organization_id == org_member["organization"].id
    )

    if estado:
        query = query.filter(Colecta.estado == estado)

    colectas = query.order_by(Colecta.created_at.desc()).all()
    return [_serialize_colecta(c, org_member["user"].id) for c in colectas]


@router.post("/", response_model=ColectaResponse)
def create_colecta(
    req: CreateColectaRequest,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Crea una nueva colecta solidaria ("vaca").
    No requiere asamblea previa: entra directamente como PROPUESTA para recibir promesas.
    """
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    if req.monto_meta_usd <= 0:
        raise HTTPException(status_code=400, detail="El monto meta debe ser mayor a 0 USD.")

    # Validar tipo de tasa
    tipo_tasa_enum = TipoTasaColecta.BCV
    try:
        tipo_tasa_enum = TipoTasaColecta(req.tipo_tasa.lower())
    except ValueError:
        tipo_tasa_enum = TipoTasaColecta.BCV

    if tipo_tasa_enum == TipoTasaColecta.FIJA and (not req.tasa_fija_valor or req.tasa_fija_valor <= 0):
        raise HTTPException(status_code=400, detail="Debe especificar un valor numérico para la tasa fija.")

    # Datos de pago del beneficiario
    datos_pago_json = "{}"
    if req.beneficiario_datos_pago:
        datos_pago_json = json.dumps(req.beneficiario_datos_pago)
    else:
        # Usar datos de pago configurados por el creador si existen
        user_config = db.query(UserPaymentConfig).filter(UserPaymentConfig.user_id == org_member["user"].id).first()
        if user_config and user_config.payment_methods_json:
            datos_pago_json = user_config.payment_methods_json

    nueva_colecta = Colecta(
        organization_id=org_member["organization"].id,
        proponente_id=org_member["user"].id,
        titulo=req.titulo.strip(),
        proposito=req.proposito.strip(),
        monto_meta_usd=float(req.monto_meta_usd),
        monto_prometido_usd=0.0,
        monto_recaudado_usd=0.0,
        tipo_tasa=tipo_tasa_enum,
        tasa_fija_valor=float(req.tasa_fija_valor) if req.tasa_fija_valor else None,
        beneficiario_id=org_member["user"].id,
        beneficiario_nombre=req.beneficiario_nombre or f"{org_member['user'].first_name} {org_member['user'].last_name or ''}".strip(),
        beneficiario_datos_pago=datos_pago_json,
        fecha_pago=req.fecha_pago,
        fecha_limite_aportes=req.fecha_limite_aportes or req.fecha_pago,
        estado=EstadoColecta.PROPUESTA
    )

    db.add(nueva_colecta)
    db.commit()
    db.refresh(nueva_colecta)

    # 1. Notificación Telegram
    rate_val = tasa_cambio.get_rate(nueva_colecta.tipo_tasa.value, nueva_colecta.tasa_fija_valor)
    msg = (
        f"🐮 <b>¡Nueva Colecta Familiar Propuesta!</b>\n\n"
        f"🎯 <b>{nueva_colecta.titulo}</b>\n"
        f"👤 Proponente: {org_member['user'].first_name}\n"
        f"💵 Meta: <b>${nueva_colecta.monto_meta_usd:,.2f} USD</b>\n"
        f"📊 Tasa acordada: <b>{nueva_colecta.tipo_tasa.value.upper()}</b> (Ref: Bs {rate_val:,.2f})\n"
        f"📅 Fecha de pago: {nueva_colecta.fecha_pago}\n"
        f"📝 <i>{nueva_colecta.proposito}</i>"
    )
    send_telegram_notification(msg)

    # 2. Notificación Push a los demás miembros
    other_members = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org_member["organization"].id,
        OrganizationMembership.user_id != org_member["user"].id
    ).all()
    other_ids = [m.user_id for m in other_members]
    if other_ids:
        notify_users(
            db,
            other_ids,
            "🐮 Nueva Colecta Familiar",
            f"{org_member['user'].first_name} propuso la colecta '{nueva_colecta.titulo}' por ${nueva_colecta.monto_meta_usd:,.2f} USD."
        )

    # 3. Notificación WebSocket
    notify_org(nueva_colecta.organization_id, "COLECTAS_CHANGED")

    return _serialize_colecta(nueva_colecta, org_member["user"].id)


@router.get("/{colecta_id}", response_model=ColectaResponse)
def get_colecta_detail(
    colecta_id: int,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """Obtiene el detalle completo de una colecta, incluyendo compromisos y tasas."""
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    return _serialize_colecta(colecta, org_member["user"].id)


@router.post("/{colecta_id}/compromisos", response_model=ColectaResponse)
def pledge_commitment(
    colecta_id: int,
    req: PledgeCommitmentRequest,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Registra una promesa voluntaria de aporte en USD a la colecta.
    Si el monto total prometido alcanza el 100% de la meta, la colecta pasa automáticamente a ACTIVA.
    """
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    if req.monto_usd <= 0:
        raise HTTPException(status_code=400, detail="El monto prometido debe ser mayor a 0 USD.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    if colecta.estado not in [EstadoColecta.PROPUESTA, EstadoColecta.ACTIVA]:
        raise HTTPException(status_code=400, detail="Esta colecta ya no está recibiendo promesas de aportes.")

    # Crear compromiso
    nuevo_compromiso = CompromisoColecta(
        colecta_id=colecta.id,
        socio_id=org_member["user"].id,
        monto_usd=float(req.monto_usd),
        estado=EstadoCompromiso.PROMETIDO,
        fecha_compromiso=utcnow()
    )
    db.add(nuevo_compromiso)

    # Actualizar acumulado de promesas
    colecta.monto_prometido_usd += float(req.monto_usd)

    # Verificar si alcanza el quorum de activación (100% o más)
    alcanzo_quorum = colecta.monto_prometido_usd >= colecta.monto_meta_usd
    paso_a_activa = False

    if colecta.estado == EstadoColecta.PROPUESTA and alcanzo_quorum:
        colecta.estado = EstadoColecta.ACTIVA
        paso_a_activa = True

    db.commit()
    db.refresh(colecta)

    # 1. Notificación Push al socio que prometió
    notify_users(
        db,
        [org_member["user"].id],
        "Aporte Prometido",
        f"Registraste un aporte de ${req.monto_usd:,.2f} USD para '{colecta.titulo}'."
    )

    # 2. Si pasó a ACTIVA, notificar a todos los miembros
    if paso_a_activa:
        msg_activa = (
            f"🎉 <b>¡Meta de Colecta Alcanzada!</b>\n\n"
            f"La colecta <b>{colecta.titulo}</b> ha alcanzado el 100% de su meta (${colecta.monto_prometido_usd:,.2f} / ${colecta.monto_meta_usd:,.2f} USD).\n"
            f"📅 Fecha de cobro programada: <b>{colecta.fecha_pago}</b>."
        )
        send_telegram_notification(msg_activa)

        all_members = db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == colecta.organization_id
        ).all()
        member_ids = [m.user_id for m in all_members]
        notify_users(
            db,
            member_ids,
            "🎉 ¡Colecta Activada!",
            f"La colecta '{colecta.titulo}' alcanzó el 100% de su meta. Fecha de cobro: {colecta.fecha_pago}."
        )

    # 3. Notificación WebSocket
    notify_org(colecta.organization_id, "COLECTAS_CHANGED")

    return _serialize_colecta(colecta, org_member["user"].id)


@router.delete("/{colecta_id}/compromisos/{compromiso_id}", response_model=ColectaResponse)
def cancel_commitment(
    colecta_id: int,
    compromiso_id: int,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Cancela un compromiso de aporte voluntario.
    Permitido en cualquier momento antes de que el estado sea PAGADO.
    Si al cancelar el monto cae por debajo del 100%, la colecta revierte a PROPUESTA
    y se notifica inmediatamente a todos los demás aportantes.
    """
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    compromiso = db.query(CompromisoColecta).filter(
        CompromisoColecta.id == compromiso_id,
        CompromisoColecta.colecta_id == colecta.id
    ).first()

    if not compromiso:
        raise HTTPException(status_code=404, detail="Compromiso no encontrado.")

    if compromiso.socio_id != org_member["user"].id:
        raise HTTPException(status_code=403, detail="Solo puedes cancelar tu propio compromiso.")

    if compromiso.estado == EstadoCompromiso.PAGADO:
        raise HTTPException(status_code=400, detail="No se puede cancelar un aporte que ya ha sido pagado.")

    if compromiso.estado == EstadoCompromiso.CANCELADO:
        raise HTTPException(status_code=400, detail="El compromiso ya se encuentra cancelado.")

    monto_cancelado = compromiso.monto_usd
    compromiso.estado = EstadoCompromiso.CANCELADO
    compromiso.fecha_cancelacion = utcnow()

    # Reducir el total prometido
    colecta.monto_prometido_usd = max(0.0, colecta.monto_prometido_usd - monto_cancelado)

    # Verificar si revierte de ACTIVA a PROPUESTA
    revirtio_a_propuesta = False
    if colecta.estado == EstadoColecta.ACTIVA and colecta.monto_prometido_usd < colecta.monto_meta_usd:
        colecta.estado = EstadoColecta.PROPUESTA
        revirtio_a_propuesta = True

    db.commit()
    db.refresh(colecta)

    # Si revirtió de ACTIVA a PROPUESTA, notificar inmediatamente a los demás aportantes
    if revirtio_a_propuesta:
        # Aportantes activos de la colecta (excluyendo al que canceló)
        otros_compromisos = db.query(CompromisoColecta).filter(
            CompromisoColecta.colecta_id == colecta.id,
            CompromisoColecta.estado.in_([EstadoCompromiso.PROMETIDO, EstadoCompromiso.NOTIFICADO]),
            CompromisoColecta.socio_id != org_member["user"].id
        ).all()
        aportantes_afectados_ids = list(set([c.socio_id for c in otros_compromisos]))

        if aportantes_afectados_ids:
            notify_users(
                db,
                aportantes_afectados_ids,
                "⚠️ Colecta en espera de aportes",
                f"Se canceló un compromiso en '{colecta.titulo}'. La colecta volvió a fase de propuesta para completar la meta."
            )

        msg_rev = (
            f"⚠️ <b>Colecta en Espera de Aportes</b>\n\n"
            f"Se canceló un compromiso de ${monto_cancelado:,.2f} USD en <b>{colecta.titulo}</b>.\n"
            f"El total prometido ahora es de ${colecta.monto_prometido_usd:,.2f} / ${colecta.monto_meta_usd:,.2f} USD.\n"
            f"La colecta ha regresado a fase de PROPUESTA para sumar nuevos aportantes."
        )
        send_telegram_notification(msg_rev)

    # Notificación WebSocket
    notify_org(colecta.organization_id, "COLECTAS_CHANGED")

    return _serialize_colecta(colecta, org_member["user"].id)


@router.post("/{colecta_id}/notificar-cobro", response_model=ColectaResponse)
def trigger_payment_notifications(
    colecta_id: int,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Calcula el monto exacto en Bolívares de cada compromiso según la tasa del día
    y envía la notificación push con los montos en Bs a cada aportante.
    """
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    tasa_tipo_str = colecta.tipo_tasa.value if hasattr(colecta.tipo_tasa, "value") else str(colecta.tipo_tasa)
    rate_hoy = tasa_cambio.get_rate(tasa_tipo_str, colecta.tasa_fija_valor)

    now = utcnow()
    compromisos_notificados = 0

    for comp in colecta.compromisos:
        if comp.estado in [EstadoCompromiso.PROMETIDO, EstadoCompromiso.NOTIFICADO]:
            comp.tasa_usada = rate_hoy
            comp.tipo_tasa_usada = tasa_tipo_str
            comp.monto_bs = round(comp.monto_usd * rate_hoy, 2)
            comp.estado = EstadoCompromiso.NOTIFICADO
            comp.fecha_notificacion = now
            compromisos_notificados += 1

            # Push notification personalizada con monto en Bs y tasa
            notify_users(
                db,
                [comp.socio_id],
                f"💵 Cobro de Colecta: {colecta.titulo}",
                f"Tu aporte de ${comp.monto_usd:,.2f} USD equivale a Bs {comp.monto_bs:,.2f} (Tasa {tasa_tipo_str.upper()}: {rate_hoy:,.2f})."
            )

    db.commit()
    db.refresh(colecta)

    notify_org(colecta.organization_id, "COLECTAS_CHANGED")
    return _serialize_colecta(colecta, org_member["user"].id)


@router.post("/{colecta_id}/compromisos/{compromiso_id}/confirmar-pago", response_model=ColectaResponse)
def confirm_commitment_payment(
    colecta_id: int,
    compromiso_id: int,
    req: ConfirmPaymentRequest,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    El aportante confirma que realizó la transferencia/pago y adjunta el comprobante y referencia.
    """
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    compromiso = db.query(CompromisoColecta).filter(
        CompromisoColecta.id == compromiso_id,
        CompromisoColecta.colecta_id == colecta.id
    ).first()

    if not compromiso:
        raise HTTPException(status_code=404, detail="Compromiso no encontrado.")

    if compromiso.socio_id != org_member["user"].id:
        raise HTTPException(status_code=403, detail="Solo puedes confirmar tu propio pago.")

    if compromiso.estado == EstadoCompromiso.PAGADO:
        raise HTTPException(status_code=400, detail="Este aporte ya fue confirmado como pagado.")

    tasa_tipo_str = colecta.tipo_tasa.value if hasattr(colecta.tipo_tasa, "value") else str(colecta.tipo_tasa)
    rate_usada = compromiso.tasa_usada or tasa_cambio.get_rate(tasa_tipo_str, colecta.tasa_fija_valor)

    compromiso.estado = EstadoCompromiso.PAGADO
    compromiso.fecha_pago = utcnow()
    compromiso.payment_method = req.payment_method
    compromiso.referencia_pago = req.referencia_pago
    compromiso.comprobante_url = req.comprobante_url
    compromiso.nota_pago = req.nota_pago
    compromiso.tasa_usada = rate_usada
    compromiso.tipo_tasa_usada = tasa_tipo_str
    if not compromiso.monto_bs:
        compromiso.monto_bs = round(compromiso.monto_usd * rate_usada, 2)

    # Sumar al recaudado
    colecta.monto_recaudado_usd += compromiso.monto_usd

    # Verificar si todos los compromisos activos ya están pagados y meta alcanzada
    activos = [c for c in colecta.compromisos if c.estado != EstadoCompromiso.CANCELADO]
    todos_pagados = all(c.estado == EstadoCompromiso.PAGADO for c in activos)

    if todos_pagados and colecta.monto_recaudado_usd >= colecta.monto_meta_usd:
        colecta.estado = EstadoColecta.CERRADA  # Esperando validación de gasto por el beneficiario

    db.commit()
    db.refresh(colecta)

    # Notificar al beneficiario/proponente
    beneficiario_id = colecta.beneficiario_id or colecta.proponente_id
    if beneficiario_id != org_member["user"].id:
        notify_users(
            db,
            [beneficiario_id],
            "💰 Aporte Confirmado",
            f"{org_member['user'].first_name} confirmó el pago de ${compromiso.monto_usd:,.2f} USD para '{colecta.titulo}'."
        )

    send_telegram_notification(
        f"💰 <b>Aporte Confirmado en Colecta</b>\n\n"
        f"👤 {org_member['user'].first_name} confirmó su pago de <b>${compromiso.monto_usd:,.2f} USD</b> para <i>{colecta.titulo}</i>.\n"
        f"Ref: <code>{req.referencia_pago or 'N/A'}</code>\n"
        f"Total recaudado: ${colecta.monto_recaudado_usd:,.2f} / ${colecta.monto_meta_usd:,.2f} USD."
    )

    notify_org(colecta.organization_id, "COLECTAS_CHANGED")
    return _serialize_colecta(colecta, org_member["user"].id)


@router.post("/{colecta_id}/validar-gasto", response_model=ColectaResponse)
def validate_expense(
    colecta_id: int,
    req: ValidateExpenseRequest,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    El beneficiario valida que realizó el gasto correspondiente.
    Adjuntar el comprobante físico (factura, foto del bien o servicio) es OPCIONAL.
    Una vez validado, la colecta pasa a estado COMPLETADA.
    """
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    # Solo el proponente o beneficiario puede validar el gasto
    if org_member["user"].id not in [colecta.proponente_id, colecta.beneficiario_id]:
        raise HTTPException(status_code=403, detail="Solo el beneficiario o proponente puede validar el gasto.")

    if not req.descripcion_gasto or not req.descripcion_gasto.strip():
        raise HTTPException(status_code=400, detail="Debe ingresar una descripción de cómo se ejecutó el gasto.")

    colecta.gasto_validado = True
    colecta.descripcion_gasto = req.descripcion_gasto.strip()
    colecta.comprobante_gasto_url = req.comprobante_gasto_url  # Puede ser None (opcional)
    colecta.estado = EstadoColecta.COMPLETADA

    db.commit()
    db.refresh(colecta)

    # Notificar a todos los miembros de la mutual
    all_members = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == colecta.organization_id
    ).all()
    member_ids = [m.user_id for m in all_members]

    beneficiario_name = colecta.beneficiario_nombre or org_member["user"].first_name
    notify_users(
        db,
        member_ids,
        "✅ Colecta Completada",
        f"{beneficiario_name} validó el gasto de la colecta '{colecta.titulo}'. ¡Gracias a todos los aportantes!"
    )

    send_telegram_notification(
        f"✅ <b>¡Gasto Validado y Colecta Completada!</b>\n\n"
        f"🎯 Colecta: <b>{colecta.titulo}</b>\n"
        f"👤 Beneficiario: {beneficiario_name}\n"
        f"📝 Detalle del gasto: <i>{colecta.descripcion_gasto}</i>\n"
        f"📎 Comprobante adjunto: {'Sí' if colecta.comprobante_gasto_url else 'No'}\n"
        f"¡Objetivo solidario cumplido exitosamente!"
    )

    notify_org(colecta.organization_id, "COLECTAS_CHANGED")
    return _serialize_colecta(colecta, org_member["user"].id)


@router.patch("/{colecta_id}/cancelar", response_model=ColectaResponse)
def cancel_colecta(
    colecta_id: int,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """Cancela una colecta antes de completarse."""
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    if colecta.proponente_id != org_member["user"].id and org_member["membership"].role != "founder":
        raise HTTPException(status_code=403, detail="Solo el proponente o fundador puede cancelar la colecta.")

    if colecta.estado == EstadoColecta.COMPLETADA:
        raise HTTPException(status_code=400, detail="No se puede cancelar una colecta ya completada.")

    colecta.estado = EstadoColecta.CANCELADA
    db.commit()
    db.refresh(colecta)

    notify_org(colecta.organization_id, "COLECTAS_CHANGED")
    return _serialize_colecta(colecta, org_member["user"].id)
