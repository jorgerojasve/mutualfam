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
            "SISTEMA_GOBERNANZA": ("DOS_FASES", "Modalidad de votación (DOS_FASES, UNA_FASE_TIEMPO, UNA_FASE_MANUAL)"),
            "TASA_CREDITO": ("5", "Tasa de Interés Créditos (%)"),
            "CUOTA_MENSUAL": ("20", "Aporte Mensual Fondo (USD)"),
            "CREDITO_MAXIMO": ("500", "Límite de Crédito (USD)"),
            "QUORUM_ASAMBLEA": ("50", "Quórum Asambleas (%)")
        }
        for k, (v, desc) in defaults.items():
            if not db.query(SystemConfig).filter(SystemConfig.key == k).first():
                db.add(SystemConfig(key=k, value=v, description=desc))
        db.commit()
