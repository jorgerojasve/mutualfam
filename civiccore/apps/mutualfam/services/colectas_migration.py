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
        ("compromisos_colecta", "monto_bs", "FLOAT"),
        ("compromisos_colecta", "tasa_usada", "FLOAT"),
        ("compromisos_colecta", "tipo_tasa_usada", "VARCHAR(50)"),
        ("compromisos_colecta", "fecha_validacion", "TIMESTAMP"),
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

        # Si el motor es PostgreSQL, asegurar que el tipo enum incluya 'validado'
        try:
            conn.execute(text("ALTER TYPE estadocompromiso ADD VALUE IF NOT EXISTS 'validado'"))
            conn.commit()
        except Exception:
            pass
