# Guía de Instalación: Entorno SVMM para Windows con Antigravity

Esta guía contiene los pasos detallados para que un colaborador con **Windows** instale y configure todo el ecosistema (Git, Python, Node.js) y el entorno de desarrollo Antigravity, de modo que pueda interactuar con el Agente de la misma forma en la que lo vienes haciendo.

---

## 1. Instalación de Prerrequisitos en Windows

### 1.1 Python
1. Descarga el instalador oficial de [Python 3.11+](https://www.python.org/downloads/windows/).
2. **IMPORTANTE:** Durante la instalación, asegúrate de marcar la casilla **"Add Python to PATH"** en la pantalla inicial antes de darle a "Install Now".

### 1.2 Node.js
1. Descarga e instala [Node.js v20 (LTS)](https://nodejs.org/en/download/) (el instalador estándar).
2. Deja todas las opciones por defecto; este instalador automáticamente configurará las variables de entorno necesarias para que comandos como `npm` y `npx` funcionen.

### 1.3 Git para Windows
1. Descarga [Git for Windows](https://gitforwindows.org/).
2. Instala con las opciones por defecto. Esto instalará tanto Git como la terminal "Git Bash", que es excelente para usar en Windows si te acostumbras a comandos estilo Linux.

---

## 2. Configuración de Llaves SSH (GitLab)

Para clonar y enviar cambios al repositorio privado en GitLab (`git@gitlab.com:demdir/MutualSol.git`):

1. Abre **Git Bash** o **PowerShell**.
2. Genera una llave SSH:
   ```bash
   ssh-keygen -t ed25519 -C "tu_correo@ejemplo.com"
   ```
   *Presiona Enter a todas las preguntas para usar las opciones por defecto.*
3. Muestra tu llave pública generada y cópiala:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
4. Ve a [GitLab > Preferences > SSH Keys](https://gitlab.com/-/profile/keys) y pega tu llave.

*(Opcional: Si usan un alias como `gitlab_yahoo` configurado en `~/.ssh/config`, debe crearse el archivo de configuración en `C:\Users\TU_USUARIO\.ssh\config` indicando el host).*

---

## 3. Clonar el Repositorio

Abre tu terminal favorita (PowerShell o Git Bash) y navega a la carpeta donde guardarás el código (ej. Documentos):
```bash
cd Documents
git clone git@gitlab.com:demdir/MutualSol.git mutualsol-workspace
cd mutualsol-workspace

# Nos pasamos a la nueva rama de la SVMM
git checkout app/svmm
```

---

## 4. Instalar y Lanzar Antigravity IDE

Antigravity es el IDE desde el que chatearás con el asistente IA.

1. Instala el CLI de Antigravity (suponiendo que usas el instalador oficial proporcionado por tu equipo):
   ```bash
   # Asegúrate de seguir las instrucciones de instalación del equipo de Antigravity
   # (Ej. pip install antigravity-ide)
   ```
2. Ejecuta el IDE en tu carpeta clonada:
   ```bash
   antigravity .
   ```
3. Se abrirá la interfaz gráfica. Desde aquí, podrás hablar con el agente y decirle: *"¡Hola! Acabo de instalar el entorno SVMM en Windows, vamos a probarlo."*

---

## 5. (Opcional) Correr los Servidores Manualmente

Aunque el agente de Antigravity suele encender los servidores por ti, aquí tienes los comandos si necesitas iniciarlos tú mismo en la terminal de Windows:

**Backend (FastAPI):**
```powershell
cd civiccore\apps\svmm
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8002 --reload
```
*(Nota: En Windows se usa `venv\Scripts\activate` en lugar de `source venv/bin/activate`)*

**Frontend Web (Dashboard):**
```powershell
cd civiccore\apps\svmm-web
npm install
npm run dev
```

**App Móvil (Expo):**
```powershell
cd civiccore\apps\svmm-app
npm install
npx expo start --clear
```

> [!TIP]
> **Recomendación sobre Antigravity:** El agente IA detecta automáticamente si estás en Windows o Linux, por lo que escribirá y ejecutará los comandos de la terminal en formato Windows (`dir`, rutas con `\`, etc.) sin que tengas que explicárselo.
