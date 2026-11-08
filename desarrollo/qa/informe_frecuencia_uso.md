# 📊 Informe Estadístico de Frecuencia y Uso en Base de Datos - MutualFam

> **Zona horaria de referencia:** Venezuela (`UTC-4`, VET).
> **Fuente:** Tablas transaccionales de SQLite (`users`, `organization_memberships`, `proposals`, `comments`, `loan_requests`, `loan_contributions`, `loan_repayments`, `colectas`, `compromisos_colecta`, `votes`).

---

## 1. Resumen Comparativo General

| Métrica | Producción (`mutualfam-backend`) | QA (`mutualfam-qa-backend`) | Total Consolidado |
| :--- | :---: | :---: | :---: |
| **Total de eventos de usuario** | 21 | 30 | 51 |
| **Días con actividad real** | 3 | 1 | 4 |
| **Rango de fechas observado** | 2026-10-25 al 2026-10-30 | 2026-11-07 al 2026-11-07 | 2026-10-25 al 2026-11-07 |
| **Promedio diario (días activos)** | **7.00 ev/día** | **30.00 ev/día** | **12.75 ev/día** |

---

## 2. Promedios por Día de la Semana

| Día de la Semana | Producción (Eventos) | Producción (% / Promedio) | QA (Eventos) | QA (% / Promedio) |
| :--- | :---: | :---: | :---: | :---: |
| **Lunes** | 0 | 0.0% (0.00/día) | 0 | 0.0% (0.00/día) |
| **Martes** | 0 | 0.0% (0.00/día) | 0 | 0.0% (0.00/día) |
| **Miércoles** | 0 | 0.0% (0.00/día) | 0 | 0.0% (0.00/día) |
| **Jueves** | 5 | 23.8% (5.00/día) | 0 | 0.0% (0.00/día) |
| **Viernes** | 3 | 14.3% (3.00/día) | 0 | 0.0% (0.00/día) |
| **Sábado** | 0 | 0.0% (0.00/día) | 30 | 100.0% (30.00/día) |
| **Domingo** | 13 | 61.9% (13.00/día) | 0 | 0.0% (0.00/día) |

---

## 3. Distribución por Día del Mes

| Día del Mes | Eventos Producción | % Prod | Eventos QA | % QA |
| :---: | :---: | :---: | :---: | :---: |
| Día 07 | 0 | 0.0% | 30 | 100.0% |
| Día 25 | 13 | 61.9% | 0 | 0.0% |
| Día 29 | 5 | 23.8% | 0 | 0.0% |
| Día 30 | 3 | 14.3% | 0 | 0.0% |

---

## 4. Distribución por Hora del Día (VET, UTC-4)

| Franja Horaria | Producción | % Prod | QA | % QA | Franja General |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `10:00 - 10:59` | 3 | 14.3% | 0 | 0.0% | Mañana    (06:00 - 11:59) |
| `11:00 - 11:59` | 4 | 19.0% | 0 | 0.0% | Mañana    (06:00 - 11:59) |
| `12:00 - 12:59` | 9 | 42.9% | 0 | 0.0% | Tarde     (12:00 - 17:59) |
| `13:00 - 13:59` | 0 | 0.0% | 6 | 20.0% | Tarde     (12:00 - 17:59) |
| `14:00 - 14:59` | 0 | 0.0% | 7 | 23.3% | Tarde     (12:00 - 17:59) |
| `16:00 - 16:59` | 0 | 0.0% | 3 | 10.0% | Tarde     (12:00 - 17:59) |
| `18:00 - 18:59` | 3 | 14.3% | 0 | 0.0% | Noche     (18:00 - 23:59) |
| `19:00 - 19:59` | 2 | 9.5% | 2 | 6.7% | Noche     (18:00 - 23:59) |
| `20:00 - 20:59` | 0 | 0.0% | 12 | 40.0% | Noche     (18:00 - 23:59) |

---

## 5. Distribución por Módulo Funcional

### Producción:
- **Préstamos Familiares**: 12 eventos (57.1%)
- **Membresía / Usuarios**: 9 eventos (42.9%)

### QA:
- **Colectas Solidarias**: 10 eventos (33.3%)
- **Gobernanza / Asamblea**: 7 eventos (23.3%)
- **Préstamos Familiares**: 7 eventos (23.3%)
- **Membresía / Usuarios**: 6 eventos (20.0%)
