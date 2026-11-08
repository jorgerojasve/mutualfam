import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)

def ensure_colectas_columns_exist(engine):
    """
    Garantiza de forma idempotente y segura que las columnas bimoneda
    existan en las tablas colectas y compromisos_colecta tanto en SQLite como en PostgreSQL.
    """
    columns = [
        ("colectas", "monto_meta_ves", "FLOAT"),
        ("colectas", "moneda_origen", "VARCHAR(10) DEFAULT 'USD'"),
        ("colectas", "motivo_cancelacion", "TEXT"),
        ("colectas", "fecha_cancelacion", "TIMESTAMP"),
        ("colectas", "hora_pago", "VARCHAR(10) DEFAULT '12:00'"),
        ("colectas", "recordatorio_previo_enviado", "BOOLEAN DEFAULT FALSE"),
        ("colectas", "recordatorio_mismo_dia_enviado", "BOOLEAN DEFAULT FALSE"),
        ("colectas", "ultimo_recordatorio_manual", "TIMESTAMP"),
        ("compromisos_colecta", "motivo_rechazo", "TEXT"),
        ("compromisos_colecta", "fecha_rechazo", "TIMESTAMP"),
        ("compromisos_colecta", "monto_bs", "FLOAT"),
        ("compromisos_colecta", "tasa_usada", "FLOAT"),
        ("compromisos_colecta", "tipo_tasa_usada", "VARCHAR(50)"),
        ("compromisos_colecta", "fecha_validacion", "TIMESTAMP"),
        ("compromisos_colecta", "fecha_devolucion", "TIMESTAMP"),
        ("compromisos_colecta", "monto_devuelto", "FLOAT"),
        ("compromisos_colecta", "moneda_devolucion", "VARCHAR(10)"),
        ("compromisos_colecta", "metodo_devolucion", "VARCHAR(50)"),
        ("compromisos_colecta", "referencia_devolucion", "VARCHAR(100)"),
        ("compromisos_colecta", "comprobante_devolucion_url", "VARCHAR(500)"),
        ("compromisos_colecta", "comision_descontada", "FLOAT DEFAULT 0.0"),
        ("comments", "stance", "VARCHAR(20)"),
        ("comments", "attachment_url", "VARCHAR(500)"),
        ("comments", "attachment_type", "VARCHAR(50)"),
    ]

    with engine.connect() as conn:
        for table, col, col_type in columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
                logger.info(f"Columna {col} agregada a la tabla {table}")
            except Exception:
                # La columna ya existe o la tabla no requiere alteración
                pass

        # Si el motor es PostgreSQL, asegurar que el tipo enum incluya 'validado' y 'devuelto'
        try:
            conn.execute(text("ALTER TYPE estadocompromiso ADD VALUE IF NOT EXISTS 'validado'"))
            conn.execute(text("ALTER TYPE estadocompromiso ADD VALUE IF NOT EXISTS 'devuelto'"))
            conn.commit()
        except Exception:
            pass
