from sqlalchemy.orm import Session
from .models import SystemConfig

class ConfigService:
    @staticmethod
    def get_all(db: Session):
        return db.query(SystemConfig).all()

    @staticmethod
    def get_value(db: Session, key: str, default_value: str = None) -> str:
        conf = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        return conf.value if conf else default_value

    @staticmethod
    def set_value(db: Session, key: str, value: str, description: str = None):
        conf = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if conf:
            conf.value = value
            if description is not None:
                conf.description = description
        else:
            conf = SystemConfig(key=key, value=value, description=description)
            db.add(conf)
        db.commit()
        db.refresh(conf)
        return conf

    @staticmethod
    def seed_defaults(db: Session):
        defaults = {
            "SISTEMA_GOBERNANZA": ("DOS_FASES", "Controla si las propuestas van a Referendo directo (UNA_FASE_TIEMPO/UNA_FASE_MANUAL) o requieren debate previo (DOS_FASES)"),
            "COALESCENCIA_ACTIVA": ("true", "Habilita la sugerencia automática de fusión de propuestas similares"),
            "FRECUENCIA_REFERENDOS": ("30", "Frecuencia en días para realizar votaciones generales (si es DOS_FASES)"),
            "DURACION_VOTACION": ("7", "Duración en días de los referendos (si es DOS_FASES)"),
            "COMENTARIOS_EN_REFERENDO": ("false", "Permitir agregar nuevos comentarios cuando una propuesta está en fase de votación oficial"),
            "TASA_CREDITO": ("5", "Tasa de Interés Créditos (%)"),
            "CUOTA_MENSUAL": ("20", "Aporte Mensual Fondo (USD)"),
            "CREDITO_MAXIMO": ("500", "Límite de Crédito (USD)"),
            "QUORUM_ASAMBLEA": ("50", "Quórum Asambleas (%)"),
            "PUNTOS_HABILITADOS_REFERENDO": ("true", "Activar Puntos de Voto (Intensity Voting) en referendos"),
            "PUNTOS_HABILITADOS_DEBATE": ("false", "Activar Puntos de Voto en fase de debate"),
            "PUNTOS_POR_MIEMBRO": ("10", "Cantidad de Puntos de Voto que recibe cada socio al renovar"),
            "PERIODO_RENOVACION_PUNTOS": ("30", "Frecuencia en días para la renovación del saldo de Puntos de Voto"),
            "MAX_PUNTOS_POR_VOTO": ("5", "Máximo de puntos que se pueden asignar a una única propuesta"),
            "SISTEMA_PONDERACION_PUNTOS": ("lineal", "Fórmula para convertir puntos en peso de voto ('lineal' o 'cuadratica')")
        }
        for k, (v, desc) in defaults.items():
            if not db.query(SystemConfig).filter(SystemConfig.key == k).first():
                db.add(SystemConfig(key=k, value=v, description=desc))
        db.commit()
