# Convenciones de Git y Madurez de Módulos (CivicCore)

En CivicCore hemos implementado un sistema de **Nivel de Madurez de Módulos (MRL — Module Readiness Level)** que permite que diferentes módulos evolucionen a su propio ritmo sin necesidad de separar el repositorio principal en múltiples submódulos complejos.

Para organizar esto a nivel de control de versiones, utilizamos convenciones de Git.

## Ramas de Calidad (QA) por Módulo

Para aislar el desarrollo y las pruebas de módulos específicos antes de que asciendan de nivel de madurez o entren a la rama principal de producción (`main` / `develop`), usamos ramas de QA.

**Formato:** `module/<nombre-del-modulo>/qa`

**Ejemplo:** Si estamos realizando pruebas de usabilidad intensivas para ascender el módulo de Fusión, el trabajo se realiza en la rama `module/fusion/qa`. Al estabilizarse, se fusiona hacia la rama principal.

## Etiquetado (Tagging) de Módulos

Dado que los módulos ascienden de nivel independientemente, utilizamos **Tags Semánticos Modulares** en Git.

**Formato:** `<module>/v<MAJOR>.<MINOR>-<estado>`

**Ejemplos:**
- `governance/v1.0-beta` (El módulo de gobernanza entra en fase Beta)
- `fusion/v0.2-experimental` (Nueva versión experimental de fusión)
- `membership/v2.0-stable` (El módulo de membresía asciende a Estable)

### Cuándo crear un Tag de Módulo
1. Cuando se actualiza el objeto `module_maturity` en `manifest.py` o `manifest.js` reflejando un cambio significativo.
2. Después de fusionar la rama de QA del módulo hacia la rama principal.

```bash
# Ejemplo de flujo
git checkout main
git merge module/governance/qa
git tag governance/v2.0-stable
git push origin main --tags
```

Este enfoque garantiza que tengamos un historial perfecto de la madurez de los módulos visible directamente en los releases de GitHub/GitLab, sin el overhead operativo de administrar N submódulos de Git independientes.
