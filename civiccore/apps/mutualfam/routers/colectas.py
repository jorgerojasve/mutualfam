from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, object_session
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
from services.telegram_bot import send_telegram_notification, send_telegram_photo
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
    monto_meta_usd: Optional[float] = None
    monto_meta_ves: Optional[float] = None
    currency: Optional[str] = "USD"  # "USD" | "VES"
    tipo_tasa: str = "bcv"  # bcv, usdt, euro, fija
    tasa_fija_valor: Optional[float] = None
    fecha_pago: date
    fecha_limite_aportes: Optional[date] = None
    beneficiario_nombre: Optional[str] = None
    beneficiario_datos_pago: Optional[Dict[str, Any]] = None


class PledgeCommitmentRequest(BaseModel):
    monto_usd: Optional[float] = None
    monto_ves: Optional[float] = None
    currency: Optional[str] = "USD"  # "USD" | "VES"


class ConfirmPaymentRequest(BaseModel):
    payment_method: Optional[str] = None
    referencia_pago: Optional[str] = None
    comprobante_url: Optional[str] = None
    nota_pago: Optional[str] = None


class ValidateExpenseRequest(BaseModel):
    descripcion_gasto: str
    comprobante_gasto_url: Optional[str] = None  # Opcional


class CancelColectaRequest(BaseModel):
    motivo: Optional[str] = "Cancelada por fuerza mayor"


class DevolverAporteRequest(BaseModel):
    monto_devuelto: float
    moneda_devolucion: str = "VES"  # "VES" | "USD"
    metodo_devolucion: Optional[str] = "Pago Móvil"
    referencia_devolucion: Optional[str] = None
    comprobante_devolucion_url: Optional[str] = None
    comision_descontada: Optional[float] = 0.0
    nota: Optional[str] = None


class CompromisoResponse(BaseModel):
    id: int
    socio_id: int
    socio_name: str
    socio_payment_methods_json: Optional[str] = "{}"
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
    fecha_validacion: Optional[datetime] = None
    fecha_cancelacion: Optional[datetime] = None
    fecha_devolucion: Optional[datetime] = None
    monto_devuelto: Optional[float] = None
    moneda_devolucion: Optional[str] = None
    metodo_devolucion: Optional[str] = None
    referencia_devolucion: Optional[str] = None
    comprobante_devolucion_url: Optional[str] = None
    comision_descontada: Optional[float] = 0.0

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
    monto_meta_bs: float
    monto_prometido_usd: float
    monto_prometido_bs: float
    monto_pagado_usd: float = 0.0
    monto_pagado_bs: float = 0.0
    monto_validado_usd: float = 0.0
    monto_validado_bs: float = 0.0
    monto_recaudado_usd: float
    monto_recaudado_bs: float = 0.0
    moneda_origen: str = "USD"
    tipo_tasa: str
    tasa_fija_valor: Optional[float] = None
    tasa_actual: float
    tasa_label: str
    beneficiario_id: Optional[int] = None
    beneficiario_nombre: Optional[str] = None
    beneficiario_datos_pago: Dict[str, Any] = {}
    gasto_validado: bool = False
    descripcion_gasto: Optional[str] = None
    comprobante_gasto_url: Optional[str] = None
    fecha_pago: date
    fecha_limite_aportes: Optional[date] = None
    estado: str
    motivo_cancelacion: Optional[str] = None
    fecha_cancelacion: Optional[datetime] = None
    tiene_devoluciones_pendientes: bool = False
    created_at: datetime
    is_active: bool
    porcentaje_prometido: float
    porcentaje_recaudado: float
    total_aportantes: int
    mi_compromiso: Optional[CompromisoResponse] = None
    mis_compromisos: List[CompromisoResponse] = []
    compromisos: List[CompromisoResponse] = []

    class Config:
        from_attributes = True


# ==========================================
# FUNCIONES AUXILIARES DE SERIALIZACIÓN
# ==========================================

def _serialize_compromiso(comp: CompromisoColecta, db: Optional[Session] = None) -> CompromisoResponse:
    socio_name = "Socio"
    if comp.socio:
        socio_name = f"{comp.socio.first_name} {comp.socio.last_name or ''}".strip() or comp.socio.email

    socio_pm_json = "{}"
    session = db
    if not session:
        try:
            session = object_session(comp)
        except Exception:
            session = None
    if session:
        try:
            cfg = session.query(UserPaymentConfig).filter(UserPaymentConfig.user_id == comp.socio_id).first()
            if cfg and cfg.payment_methods_json:
                socio_pm_json = cfg.payment_methods_json
        except Exception:
            pass

    return CompromisoResponse(
        id=comp.id,
        socio_id=comp.socio_id,
        socio_name=socio_name,
        socio_payment_methods_json=socio_pm_json,
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
        fecha_validacion=comp.fecha_validacion,
        fecha_cancelacion=comp.fecha_cancelacion,
        fecha_devolucion=getattr(comp, "fecha_devolucion", None),
        monto_devuelto=getattr(comp, "monto_devuelto", None),
        moneda_devolucion=getattr(comp, "moneda_devolucion", None),
        metodo_devolucion=getattr(comp, "metodo_devolucion", None),
        referencia_devolucion=getattr(comp, "referencia_devolucion", None),
        comprobante_devolucion_url=getattr(comp, "comprobante_devolucion_url", None),
        comision_descontada=getattr(comp, "comision_descontada", 0.0) or 0.0,
    )


def _serialize_colecta(colecta: Colecta, current_user_id: int, db: Optional[Session] = None) -> ColectaResponse:
    proponente_name = "Proponente"
    if colecta.proponente:
        proponente_name = f"{colecta.proponente.first_name} {colecta.proponente.last_name or ''}".strip() or colecta.proponente.email

    # Tasa actual y montos en Bs
    tasa_tipo_str = colecta.tipo_tasa.value if hasattr(colecta.tipo_tasa, "value") else str(colecta.tipo_tasa)
    current_rate = tasa_cambio.get_rate(tasa_tipo_str, colecta.tasa_fija_valor)
    tasa_label = tasa_cambio.LABELS.get(tasa_tipo_str, "USDT / Binance P2P" if tasa_tipo_str == "paralelo" else tasa_tipo_str.upper())

    # Cálculos financieros homologados: Prometido, Pagado (en validación) y Validado
    amt_pledged = sum(c.monto_usd for c in colecta.compromisos if c.estado in [EstadoCompromiso.PROMETIDO, EstadoCompromiso.NOTIFICADO])
    amt_paid = sum(c.monto_usd for c in colecta.compromisos if c.estado == EstadoCompromiso.PAGADO)
    amt_verified = sum(c.monto_usd for c in colecta.compromisos if c.estado == EstadoCompromiso.VALIDADO)

    monto_meta_bs = round(colecta.monto_meta_usd * current_rate, 2)
    monto_prometido_bs = round(amt_pledged * current_rate, 2)
    monto_pagado_bs = round(amt_paid * current_rate, 2)
    monto_validado_bs = round(amt_verified * current_rate, 2)
    monto_recaudado_bs = round(amt_verified * current_rate, 2)

    # Beneficiario y datos de pago
    beneficiario_name = colecta.beneficiario_nombre or proponente_name
    beneficiario_datos = {}
    if colecta.beneficiario_datos_pago:
        try:
            beneficiario_datos = json.loads(colecta.beneficiario_datos_pago)
        except Exception:
            beneficiario_datos = {}

    # Si la colecta no tiene métodos configurados directamente, buscar en UserPaymentConfig del beneficiario o proponente
    if not beneficiario_datos or beneficiario_datos == {}:
        try:
            sess = db or object_session(colecta)
            target_uid = colecta.beneficiario_id or colecta.proponente_id
            if sess and target_uid:
                u_cfg = sess.query(UserPaymentConfig).filter(UserPaymentConfig.user_id == target_uid).first()
                if u_cfg and u_cfg.payment_methods_json:
                    loaded = json.loads(u_cfg.payment_methods_json)
                    if isinstance(loaded, dict) and loaded:
                        beneficiario_datos = loaded
        except Exception:
            pass

    # Compromisos y aportantes activos
    compromisos_list = []
    mis_compromisos_list = []
    mi_compromiso = None
    aportantes_ids = set()

    session = db
    if not session:
        try:
            session = object_session(colecta)
        except Exception:
            session = None

    for comp in colecta.compromisos:
        c_ser = _serialize_compromiso(comp, db=session)
        compromisos_list.append(c_ser)
        if comp.estado != EstadoCompromiso.CANCELADO:
            aportantes_ids.add(comp.socio_id)
        if comp.socio_id == current_user_id and comp.estado != EstadoCompromiso.CANCELADO:
            mis_compromisos_list.append(c_ser)

    # mi_compromiso: priorizar el que requiera acción (prometido/notificado), luego pagado, luego último válido
    if mis_compromisos_list:
        pending_action = [c for c in mis_compromisos_list if c.estado in ["prometido", "notificado"]]
        if pending_action:
            mi_compromiso = pending_action[0]
        else:
            in_val = [c for c in mis_compromisos_list if c.estado == "pagado"]
            if in_val:
                mi_compromiso = in_val[0]
            else:
                mi_compromiso = mis_compromisos_list[-1]

    # Cálculos porcentuales
    total_committed = amt_pledged + amt_paid + amt_verified
    porc_prometido = round((total_committed / colecta.monto_meta_usd * 100), 1) if colecta.monto_meta_usd > 0 else 0.0
    porc_recaudado = round((amt_verified / colecta.monto_meta_usd * 100), 1) if colecta.monto_meta_usd > 0 else 0.0

    estado_str = colecta.estado.value if hasattr(colecta.estado, "value") else str(colecta.estado)
    is_active = (total_committed >= colecta.monto_meta_usd) or (estado_str in ["activa", "cerrada", "completada"])

    # Verificar si tiene devoluciones pendientes cuando está cancelada
    tiene_devoluciones_pendientes = False
    if estado_str == "cancelada":
        pendientes = [
            c for c in colecta.compromisos
            if c.estado in [EstadoCompromiso.PAGADO, EstadoCompromiso.VALIDADO]
            and c.payment_method != "Aporte Propio"
        ]
        tiene_devoluciones_pendientes = len(pendientes) > 0

    return ColectaResponse(
        id=colecta.id,
        organization_id=colecta.organization_id,
        proponente_id=colecta.proponente_id,
        proponente_name=proponente_name,
        titulo=colecta.titulo,
        proposito=colecta.proposito,
        monto_meta_usd=colecta.monto_meta_usd,
        monto_meta_bs=monto_meta_bs,
        monto_prometido_usd=round(amt_pledged, 2),
        monto_prometido_bs=monto_prometido_bs,
        monto_pagado_usd=round(amt_paid, 2),
        monto_pagado_bs=monto_pagado_bs,
        monto_validado_usd=round(amt_verified, 2),
        monto_validado_bs=monto_validado_bs,
        monto_recaudado_usd=round(amt_verified, 2),
        monto_recaudado_bs=monto_recaudado_bs,
        moneda_origen=getattr(colecta, "moneda_origen", "USD") or "USD",
        tipo_tasa=tasa_tipo_str,
        tasa_fija_valor=colecta.tasa_fija_valor,
        tasa_actual=current_rate,
        tasa_label=tasa_label,
        beneficiario_id=colecta.beneficiario_id or colecta.proponente_id,
        beneficiario_nombre=beneficiario_name,
        beneficiario_datos_pago=beneficiario_datos,
        gasto_validado=colecta.gasto_validado,
        descripcion_gasto=colecta.descripcion_gasto,
        comprobante_gasto_url=colecta.comprobante_gasto_url,
        fecha_pago=colecta.fecha_pago,
        fecha_limite_aportes=colecta.fecha_limite_aportes,
        estado=estado_str,
        motivo_cancelacion=getattr(colecta, "motivo_cancelacion", None),
        fecha_cancelacion=getattr(colecta, "fecha_cancelacion", None),
        tiene_devoluciones_pendientes=tiene_devoluciones_pendientes,
        created_at=colecta.created_at,
        is_active=is_active,
        porcentaje_prometido=porc_prometido,
        porcentaje_recaudado=porc_recaudado,
        total_aportantes=len(aportantes_ids),
        mi_compromiso=mi_compromiso,
        mis_compromisos=mis_compromisos_list,
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

    # Validar tipo de tasa
    tipo_tasa_enum = TipoTasaColecta.BCV
    try:
        req_tipo = req.tipo_tasa.lower()
        if req_tipo == "paralelo":
            tipo_tasa_enum = TipoTasaColecta.USDT
        else:
            tipo_tasa_enum = TipoTasaColecta(req_tipo)
    except ValueError:
        tipo_tasa_enum = TipoTasaColecta.BCV

    if tipo_tasa_enum == TipoTasaColecta.FIJA and (not req.tasa_fija_valor or req.tasa_fija_valor <= 0):
        raise HTTPException(status_code=400, detail="Debe especificar un valor numérico para la tasa fija.")

    rate_val = tasa_cambio.get_rate(tipo_tasa_enum.value, req.tasa_fija_valor)
    if rate_val <= 0:
        rate_val = 1.0

    currency = (req.currency or "USD").upper()
    if currency == "VES":
        if not req.monto_meta_ves or req.monto_meta_ves <= 0:
            raise HTTPException(status_code=400, detail="El monto meta en Bs debe ser mayor a 0.")
        meta_ves = float(req.monto_meta_ves)
        meta_usd = round(meta_ves / rate_val, 2)
    else:
        if not req.monto_meta_usd or req.monto_meta_usd <= 0:
            raise HTTPException(status_code=400, detail="El monto meta debe ser mayor a 0 USD.")
        meta_usd = float(req.monto_meta_usd)
        meta_ves = round(meta_usd * rate_val, 2)

    # Datos de pago del beneficiario
    datos_pago_json = "{}"
    if req.beneficiario_datos_pago and isinstance(req.beneficiario_datos_pago, dict) and req.beneficiario_datos_pago:
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
        monto_meta_usd=meta_usd,
        monto_meta_ves=meta_ves,
        moneda_origen=currency,
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
    msg = (
        f"🐮 <b>¡Nueva Colecta Familiar Propuesta!</b>\n\n"
        f"🎯 <b>{nueva_colecta.titulo}</b>\n"
        f"👤 Proponente: {org_member['user'].first_name}\n"
        f"💵 Meta: <b>${nueva_colecta.monto_meta_usd:,.2f} USD</b> (Bs {meta_ves:,.2f})\n"
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
            f"{org_member['user'].first_name} propuso la colecta '{nueva_colecta.titulo}' por ${nueva_colecta.monto_meta_usd:,.2f} USD (Bs {meta_ves:,.2f})."
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
    Registra una promesa voluntaria de aporte (bimoneda USD/VES) a la colecta.
    Si el monto total prometido alcanza el 100% de la meta, la colecta pasa automáticamente a ACTIVA.
    """
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    if colecta.estado not in [EstadoColecta.PROPUESTA, EstadoColecta.ACTIVA]:
        raise HTTPException(status_code=400, detail="Esta colecta ya no está recibiendo promesas de aportes.")

    tasa_tipo_str = colecta.tipo_tasa.value if hasattr(colecta.tipo_tasa, "value") else str(colecta.tipo_tasa)
    rate_val = tasa_cambio.get_rate(tasa_tipo_str, colecta.tasa_fija_valor)
    if rate_val <= 0:
        rate_val = 1.0

    currency = (req.currency or "USD").upper()
    if currency == "VES":
        if not req.monto_ves or req.monto_ves <= 0:
            raise HTTPException(status_code=400, detail="El monto prometido en Bs debe ser mayor a 0.")
        pledge_ves = float(req.monto_ves)
        pledge_usd = round(pledge_ves / rate_val, 2)
    else:
        if not req.monto_usd or req.monto_usd <= 0:
            raise HTTPException(status_code=400, detail="El monto prometido debe ser mayor a 0 USD.")
        pledge_usd = float(req.monto_usd)
        pledge_ves = round(pledge_usd * rate_val, 2)

    # Crear compromiso
    nuevo_compromiso = CompromisoColecta(
        colecta_id=colecta.id,
        socio_id=org_member["user"].id,
        monto_usd=pledge_usd,
        monto_bs=pledge_ves,
        tasa_usada=rate_val,
        tipo_tasa_usada=tasa_tipo_str,
        estado=EstadoCompromiso.PROMETIDO,
        fecha_compromiso=utcnow()
    )
    db.add(nuevo_compromiso)

    # Actualizar acumulado de promesas
    colecta.monto_prometido_usd += pledge_usd

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
        f"Registraste un aporte de ${pledge_usd:,.2f} USD (Bs {pledge_ves:,.2f}) para '{colecta.titulo}'."
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

    if compromiso.estado in [EstadoCompromiso.PAGADO, EstadoCompromiso.VALIDADO]:
        raise HTTPException(status_code=400, detail="No se puede cancelar un aporte que ya ha sido pagado o validado.")

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

    if compromiso.estado in [EstadoCompromiso.PAGADO, EstadoCompromiso.VALIDADO]:
        raise HTTPException(status_code=400, detail="Este aporte ya fue confirmado como pagado.")

    tasa_tipo_str = colecta.tipo_tasa.value if hasattr(colecta.tipo_tasa, "value") else str(colecta.tipo_tasa)
    rate_usada = compromiso.tasa_usada or tasa_cambio.get_rate(tasa_tipo_str, colecta.tasa_fija_valor)

    gestor_id = colecta.beneficiario_id or colecta.proponente_id
    is_self = (org_member["user"].id == gestor_id)

    # Si quien paga es quien gestiona la colecta (aporte propio), se valida de inmediato
    if is_self:
        compromiso.estado = EstadoCompromiso.VALIDADO
        compromiso.fecha_validacion = utcnow()
    else:
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

    # Recalcular monto validado
    amt_verified = sum(c.monto_usd for c in colecta.compromisos if c.estado == EstadoCompromiso.VALIDADO)
    colecta.monto_recaudado_usd = amt_verified

    # Verificar si todos los compromisos activos ya están validados y meta alcanzada
    activos = [c for c in colecta.compromisos if c.estado != EstadoCompromiso.CANCELADO]
    todos_validados = all(c.estado == EstadoCompromiso.VALIDADO for c in activos)

    if todos_validados and colecta.monto_recaudado_usd >= (colecta.monto_meta_usd - 0.001):
        colecta.estado = EstadoColecta.CERRADA  # Esperando validación de gasto por el beneficiario

    db.commit()
    db.refresh(colecta)

    # Notificar al beneficiario/proponente si es pago de otro socio
    if not is_self and gestor_id:
        notify_users(
            db,
            [gestor_id],
            "🕐 Pago Notificado",
            f"{org_member['user'].first_name} notificó el pago de ${compromiso.monto_usd:,.2f} USD para '{colecta.titulo}'. Pendiente de validación."
        )

    if is_self:
        msg_pago = (
            f"💰 <b>Aporte Propio Confirmado y Validado</b>\n\n"
            f"🎯 Colecta: <b>{colecta.titulo}</b>\n"
            f"👤 {org_member['user'].first_name} registró su propio aporte de <b>${compromiso.monto_usd:,.2f} USD</b>.\n"
            f"Total validado: ${colecta.monto_recaudado_usd:,.2f} / ${colecta.monto_meta_usd:,.2f} USD."
        )
    else:
        msg_pago = (
            f"🕐 <b>Pago Notificado en Colecta (En Validación)</b>\n\n"
            f"🎯 Colecta: <b>{colecta.titulo}</b>\n"
            f"👤 {org_member['user'].first_name} notificó su pago de <b>${compromiso.monto_usd:,.2f} USD</b>.\n"
            f"Ref: <code>{req.referencia_pago or 'N/A'}</code>\n"
            f"Total validado: ${colecta.monto_recaudado_usd:,.2f} / ${colecta.monto_meta_usd:,.2f} USD."
        )

    if compromiso.comprobante_url:
        import os
        from routers.upload import UPLOADS_DIR
        filename = os.path.basename(compromiso.comprobante_url)
        photo_path = os.path.join(UPLOADS_DIR, filename)
        if not os.path.exists(photo_path):
            photo_path = f".{compromiso.comprobante_url}"
        if os.path.exists(photo_path):
            send_telegram_photo(msg_pago, photo_path)
        else:
            send_telegram_notification(msg_pago)
    else:
        send_telegram_notification(msg_pago)

    notify_org(colecta.organization_id, "COLECTAS_CHANGED")
    return _serialize_colecta(colecta, org_member["user"].id)


@router.post("/{colecta_id}/compromisos/{compromiso_id}/validar-pago", response_model=ColectaResponse)
def verify_commitment_payment(
    colecta_id: int,
    compromiso_id: int,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    El responsable (Gestionado por / Beneficiario) de la colecta confirma que recibió el pago.
    El estado del compromiso pasa de PAGADO (en validación) a VALIDADO.
    """
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()
    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    gestor_id = colecta.beneficiario_id or colecta.proponente_id
    if gestor_id != org_member["user"].id:
        raise HTTPException(status_code=403, detail="Solo el responsable de la colecta puede validar los pagos.")

    compromiso = db.query(CompromisoColecta).filter(
        CompromisoColecta.id == compromiso_id,
        CompromisoColecta.colecta_id == colecta.id
    ).first()
    if not compromiso:
        raise HTTPException(status_code=404, detail="Compromiso no encontrado.")

    if compromiso.estado != EstadoCompromiso.PAGADO:
        raise HTTPException(status_code=400, detail="Solo se pueden validar aportes con pago notificado.")

    compromiso.estado = EstadoCompromiso.VALIDADO
    compromiso.fecha_validacion = utcnow()

    # Recalcular recaudado validado
    amt_verified = sum(c.monto_usd for c in colecta.compromisos if c.estado == EstadoCompromiso.VALIDADO)
    colecta.monto_recaudado_usd = amt_verified

    # Verificar si todos los compromisos activos ya están validados y meta alcanzada
    activos = [c for c in colecta.compromisos if c.estado != EstadoCompromiso.CANCELADO]
    todos_validados = all(c.estado == EstadoCompromiso.VALIDADO for c in activos)
    if todos_validados and colecta.monto_recaudado_usd >= (colecta.monto_meta_usd - 0.001):
        colecta.estado = EstadoColecta.CERRADA

    db.commit()
    db.refresh(colecta)

    socio_name = f"{compromiso.socio.first_name} {compromiso.socio.last_name or ''}".strip() if compromiso.socio else "Socio"
    msg_val = (
        f"👍 <b>¡Pago Verificado en Colecta!</b>\n\n"
        f"🎯 Colecta: <b>{colecta.titulo}</b>\n"
        f"👤 {org_member['user'].first_name} confirmó recibir el aporte de <b>${compromiso.monto_usd:,.2f} USD</b> de <b>{socio_name}</b>.\n"
        f"Total validado: ${colecta.monto_recaudado_usd:,.2f} / ${colecta.monto_meta_usd:,.2f} USD."
    )
    send_telegram_notification(msg_val)

    notify_users(
        db,
        [compromiso.socio_id],
        "Pago verificado",
        f"{org_member['user'].first_name} confirmó recibir tu aporte de ${compromiso.monto_usd:,.2f} USD para '{colecta.titulo}'."
    )

    notify_org(colecta.organization_id, "COLECTAS_CHANGED")
    return _serialize_colecta(colecta, org_member["user"].id)
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
        raise HTTPException(status_code=403, detail="Solo el responsable de la gestión o proponente puede validar el gasto.")

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

    msg_gasto = (
        f"✅ <b>¡Gasto Validado y Colecta Completada!</b>\n\n"
        f"🎯 Colecta: <b>{colecta.titulo}</b>\n"
        f"👤 Gestionado por: {beneficiario_name}\n"
        f"📝 Detalle del gasto: <i>{colecta.descripcion_gasto}</i>\n"
        f"¡Objetivo solidario cumplido exitosamente!"
    )
    if colecta.comprobante_gasto_url:
        import os
        from routers.upload import UPLOADS_DIR
        filename = os.path.basename(colecta.comprobante_gasto_url)
        photo_path = os.path.join(UPLOADS_DIR, filename)
        if not os.path.exists(photo_path):
            photo_path = f".{colecta.comprobante_gasto_url}"
        if os.path.exists(photo_path):
            send_telegram_photo(msg_gasto, photo_path)
        else:
            send_telegram_notification(msg_gasto)
    else:
        send_telegram_notification(msg_gasto)

    notify_org(colecta.organization_id, "COLECTAS_CHANGED")
    return _serialize_colecta(colecta, org_member["user"].id)


@router.patch("/{colecta_id}/cancelar", response_model=ColectaResponse)
def cancel_colecta(
    colecta_id: int,
    req: Optional[CancelColectaRequest] = None,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """Cancela una colecta por fuerza mayor y permite devolver los fondos recaudados."""
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    gestor_ids = [colecta.proponente_id]
    if colecta.beneficiario_id:
        gestor_ids.append(colecta.beneficiario_id)

    if org_member["user"].id not in gestor_ids and org_member["membership"].role != "founder":
        raise HTTPException(status_code=403, detail="Solo quien gestiona o el fundador puede cancelar la colecta.")

    if colecta.estado == EstadoColecta.COMPLETADA:
        raise HTTPException(status_code=400, detail="No se puede cancelar una colecta ya completada (gasto ya ejecutado).")

    motivo = req.motivo.strip() if req and req.motivo else "Cancelada por fuerza mayor"
    colecta.estado = EstadoColecta.CANCELADA
    colecta.motivo_cancelacion = motivo
    colecta.fecha_cancelacion = utcnow()

    # Cancelar compromisos que aún no habían sido pagados
    for comp in colecta.compromisos:
        if comp.estado in [EstadoCompromiso.PROMETIDO, EstadoCompromiso.NOTIFICADO]:
            comp.estado = EstadoCompromiso.CANCELADO
            comp.fecha_cancelacion = utcnow()

    db.commit()
    db.refresh(colecta)

    # Notificar a los miembros
    all_members = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == colecta.organization_id
    ).all()
    member_ids = [m.user_id for m in all_members]

    hay_pagados = any(
        c.estado in [EstadoCompromiso.PAGADO, EstadoCompromiso.VALIDADO] and c.payment_method != "Aporte Propio"
        for c in colecta.compromisos
    )
    detalle_devolucion = " Quien gestiona procederá a devolver los fondos recaudados a cada aportante según el método de pago original." if hay_pagados else ""

    notify_users(
        db,
        member_ids,
        "⚠️ Colecta Cancelada por Fuerza Mayor",
        f"La colecta '{colecta.titulo}' fue cancelada. Motivo: {motivo}.{detalle_devolucion}"
    )

    msg_cancel = (
        f"⚠️ <b>Colecta Cancelada por Fuerza Mayor</b>\n\n"
        f"🎯 Colecta: <b>{colecta.titulo}</b>\n"
        f"📝 Motivo: <i>{motivo}</i>\n"
        f"{detalle_devolucion}\n"
    )
    send_telegram_notification(msg_cancel)

    notify_org(colecta.organization_id, "COLECTAS_CHANGED")
    return _serialize_colecta(colecta, org_member["user"].id, db=db)


@router.post("/{colecta_id}/compromisos/{compromiso_id}/devolver", response_model=ColectaResponse)
def refund_commitment(
    colecta_id: int,
    compromiso_id: int,
    req: DevolverAporteRequest,
    org_member: dict = Depends(get_current_org_member),
    db: Session = Depends(get_db)
):
    """
    Registra la devolución de un aporte por fuerza mayor.
    En este caso no aplica la contabilidad en dólares, sino que se devuelve de acuerdo al método de pago usado:
    - Pago Móvil / Transferencia: mismo monto en Bs (descontando comisiones asociadas si aplica).
    - Efectivo: mismo efectivo.
    """
    if not org_member["organization"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar una mutual familiar.")

    colecta = db.query(Colecta).filter(
        Colecta.id == colecta_id,
        Colecta.organization_id == org_member["organization"].id
    ).first()

    if not colecta:
        raise HTTPException(status_code=404, detail="Colecta no encontrada.")

    gestor_ids = [colecta.proponente_id]
    if colecta.beneficiario_id:
        gestor_ids.append(colecta.beneficiario_id)

    if org_member["user"].id not in gestor_ids and org_member["membership"].role != "founder":
        raise HTTPException(status_code=403, detail="Solo quien gestiona la colecta o el fundador puede registrar devoluciones.")

    compromiso = db.query(CompromisoColecta).filter(
        CompromisoColecta.id == compromiso_id,
        CompromisoColecta.colecta_id == colecta.id
    ).first()

    if not compromiso:
        raise HTTPException(status_code=404, detail="Aporte no encontrado.")

    if compromiso.estado not in [EstadoCompromiso.PAGADO, EstadoCompromiso.VALIDADO]:
        raise HTTPException(status_code=400, detail=f"No se puede devolver un aporte en estado '{compromiso.estado.value}'. Solo aportes pagados o validados.")

    if req.monto_devuelto <= 0:
        raise HTTPException(status_code=400, detail="El monto devuelto debe ser mayor a 0.")

    compromiso.estado = EstadoCompromiso.DEVUELTO
    compromiso.fecha_devolucion = utcnow()
    compromiso.monto_devuelto = req.monto_devuelto
    compromiso.moneda_devolucion = (req.moneda_devolucion or "VES").upper()
    compromiso.metodo_devolucion = req.metodo_devolucion or compromiso.payment_method or "Pago Móvil"
    compromiso.referencia_devolucion = req.referencia_devolucion.strip() if req.referencia_devolucion else None
    compromiso.comprobante_devolucion_url = req.comprobante_devolucion_url
    compromiso.comision_descontada = req.comision_descontada or 0.0

    db.commit()
    db.refresh(colecta)

    socio_name = "Socio"
    if compromiso.socio:
        socio_name = f"{compromiso.socio.first_name} {compromiso.socio.last_name or ''}".strip() or compromiso.socio.email

    moneda_simbolo = "Bs" if compromiso.moneda_devolucion == "VES" else "$"
    monto_fmt = f"{moneda_simbolo} {compromiso.monto_devuelto:,.2f}"

    # Notificar al socio aportante
    notify_users(
        db,
        [compromiso.socio_id],
        "🔄 Aporte Devuelto",
        f"Se te ha devuelto tu aporte de {monto_fmt} para '{colecta.titulo}' mediante {compromiso.metodo_devolucion} (Ref: {compromiso.referencia_devolucion or 'N/A'})."
    )

    msg_tel = (
        f"🔄 <b>Aporte Devuelto por Cancelación</b>\n\n"
        f"🎯 Colecta: <b>{colecta.titulo}</b>\n"
        f"👤 Aportante: <b>{socio_name}</b>\n"
        f"💵 Monto Devuelto: <b>{monto_fmt}</b> ({compromiso.metodo_devolucion})\n"
        f"🔢 Ref: <code>{compromiso.referencia_devolucion or 'Efectivo/Directo'}</code>\n"
    )
    send_telegram_notification(msg_tel)

    notify_org(colecta.organization_id, "COLECTAS_CHANGED")
    return _serialize_colecta(colecta, org_member["user"].id, db=db)
