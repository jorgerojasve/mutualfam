# Guía y Mejores Prácticas: Base de Datos y ORM (SQLAlchemy)

Este documento contiene las reglas de oro y lecciones aprendidas para trabajar con bases de datos relacionales, migraciones y el ORM SQLAlchemy en los backends de CivicCore.

---

## 1. Modificar Modelos vs Migraciones Reales

Cuando usas `Base.metadata.create_all(bind=engine)` (típico en la etapa de MVP o desarrollo rápido con SQLite), **SQLAlchemy solo crea tablas nuevas si no existen**. 

### 🔴 Error Común: Agregar una columna y esperar que aparezca
Si agregas un campo nuevo a un modelo existente en `models.py` (ej. `accepted_payment_methods = Column(Text)`):
- **Problema:** Al reiniciar el servidor e intentar hacer un `SELECT` a la tabla, la base de datos lanzará un `OperationalError: no such column`.
- **Causa:** `create_all` **NO** ejecuta sentencias `ALTER TABLE` para agregar columnas a tablas que ya fueron creadas.
- **Solución Rápida (Desarrollo local sin datos importantes):** Borrar el archivo de la base de datos (ej. `mutualfam.db`) para que SQLAlchemy genere todo desde cero.
- **Solución Segura (Conservando datos):** Ejecutar manualmente la actualización en SQLite:
  ```sql
  ALTER TABLE nombre_de_tabla ADD COLUMN nueva_columna TEXT DEFAULT '[]';
  ```

> **Nota para el futuro:** A medida que los proyectos maduran, se debe incorporar **Alembic** para manejar migraciones de esquema reales de forma programática.

---

## 2. El Peligro Oculto de los `Enum` en SQLAlchemy

Cuando defines un Enum en Python para usarlo como columna en la base de datos:

```python
import enum

class ContributionStatus(str, enum.Enum):
    PLEDGED = "pledged"
    PAID = "paid"
    VERIFIED = "verified"
    REJECTED = "rejected"
```

### 🔴 La Lección del "LookupError"
- **Cómo guarda SQLAlchemy los datos por defecto:** En lugar de guardar el valor de la cadena (ej. `"pledged"`), SQLAlchemy guarda **el nombre de la variable / llave** del Enum, es decir, `"PLEDGED"` (en mayúsculas).
- **El Peligro de Modificar un Enum:** Si decides eliminar o cambiar el nombre de una clave en tu clase Enum (ej. tenías `PENDING_PROOF` y lo borraste para usar `PLEDGED`), tu código Python estará actualizado, pero **las filas viejas en tu base de datos seguirán teniendo el texto `"PENDING_PROOF"`**.
- **El Choque:** Cuando el ORM intente consultar una fila vieja, leerá `"PENDING_PROOF"`, intentará buscarlo en la clase `ContributionStatus`, no lo encontrará, y la aplicación completa crasheará con:
  `LookupError: 'PENDING_PROOF' is not among the defined enum values.`

### ✅ Solución y Mejor Práctica
1. **Nunca borres ni cambies nombres de Enums** si no vas a migrar la base de datos simultáneamente.
2. Si cambias la estructura de un Enum, **debes ejecutar un UPDATE manual en la base de datos** para transformar los estados viejos a los nuevos ANTES de levantar el backend:
  ```sql
  UPDATE nombre_tabla SET status = 'PLEDGED' WHERE status = 'PENDING_PROOF';
  ```
3. Si accidentalmente haces una consulta SQL manual y escribes el estado en minúsculas (`UPDATE tabla SET status = 'pledged'`), el ORM volverá a crashear porque espera el nombre exacto de la llave en Python (`PLEDGED`).
