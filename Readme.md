# Arquitectura CI/CD DevSecOps

Este proyecto implementa un pipeline de integración y entrega continua con prácticas de seguridad integradas (DevSecOps). Cada vez que se sube código a la rama `main`, el pipeline se activa automáticamente.

---

## Justificación Técnica de Decisiones

El siguiente cuadro responde **qué herramienta se usa, en qué fase DevSecOps actúa, qué riesgo mitiga y por qué sigue siendo necesaria aunque el sistema ya funcione.**

### 1. Pruebas Unitarias automáticas (`npm test` + Jest)

| Atributo | Detalle |
|---|---|
| **Herramienta** | Jest (framework de testing para Node.js) |
| **Fase DevSecOps** | **Develop** — primera línea de defensa antes de integrar código |
| **Riesgo que mitiga** | Regresiones funcionales: cambios en el código que rompen comportamiento existente sin que el desarrollador lo note |
| **Por qué es necesaria** | Un sistema funcional hoy puede dejar de serlo mañana con cualquier cambio. Las pruebas automatizadas detectan errores en segundos, antes de que lleguen a producción. Sin esta etapa, la integración continua carece de garantía de calidad mínima. |

### 2. Análisis Estático de Seguridad — SAST (`Semgrep`)

| Atributo | Detalle |
|---|---|
| **Herramienta** | Semgrep con reglas auto-detectadas por lenguaje |
| **Fase DevSecOps** | **Build** — análisis del código fuente sin ejecutarlo |
| **Riesgo que mitiga** | Vulnerabilidades de código: inyecciones (SQL, NoSQL, comandos), secretos expuestos en el código, uso inseguro de APIs criptográficas, manejo incorrecto de errores |
| **Por qué es necesaria** | Los desarrolladores no detectan todos los patrones inseguros en revisiones manuales. Una aplicación que funciona correctamente puede tener vulnerabilidades que un atacante explotaría en producción. SAST analiza el 100% del código en cada push sin intervención humana. |

### 3. Build de Imágenes Docker (`docker compose build`)

| Atributo | Detalle |
|---|---|
| **Herramienta** | Docker + Docker Compose |
| **Fase DevSecOps** | **Package** — empaquetado del artefacto desplegable |
| **Riesgo que mitiga** | Inconsistencia entre entornos: "funciona en mi máquina". Garantiza que el artefacto desplegado es idéntico en CI, staging y producción |
| **Por qué es necesaria** | La contenedorización es la base del análisis de vulnerabilidades (Trivy escanea la imagen, no el código). Además, la imagen se convierte en el artefacto inmutable que avanza por el pipeline, lo que permite rastrear exactamente qué se desplegó. |

### 4. Análisis de Componentes con Vulnerabilidades — SCA (`Trivy`)

| Atributo | Detalle |
|---|---|
| **Herramienta** | Trivy (Aqua Security) |
| **Fase DevSecOps** | **Test de Seguridad** — escaneo de la imagen antes del despliegue |
| **Riesgo que mitiga** | Vulnerabilidades conocidas (CVEs) en dependencias de terceros: librerías de Node.js, paquetes del sistema operativo base (Alpine), binarios incluidos en la imagen |
| **Por qué es necesaria** | El 80% de las vulnerabilidades modernas provienen de dependencias, no del código propio. Una librería puede volverse vulnerable días después de haber sido instalada. Trivy consulta bases de datos actualizadas de CVEs en cada ejecución, detectando riesgos que al momento de escribir el código no existían. La severidad está configurada en **CRITICAL** para bloquear solo riesgos reales y no generar fatiga de alertas. |

### 5. Smoke Tests E2E (`curl` + Docker Compose)

| Atributo | Detalle |
|---|---|
| **Herramienta** | `curl` contra el stack completo levantado con Docker Compose |
| **Fase DevSecOps** | **Verify** — verificación de integridad del sistema integrado |
| **Riesgo que mitiga** | Fallos de integración: un servicio funciona correctamente en aislamiento pero falla al comunicarse con otros (red, autenticación, configuración de variables de entorno, JWT) |
| **Por qué es necesaria** | Las pruebas unitarias verifican componentes en aislamiento. Los smoke tests verifican que el sistema completo —con sus redes Docker, variables de entorno y dependencias entre servicios— funciona de extremo a extremo. Detectan problemas de configuración e integración que las pruebas unitarias no pueden ver. |

---


El pipeline está dividido en **6 etapas** que se ejecutan en el orden mostrado. Las etapas del mismo nivel corren **en paralelo** para reducir el tiempo total.

```
┌─────────────────────────────────────────────────────┐
│  ETAPA 1 – TESTS (paralelo)                         │
│  ┌──────────────┐ ┌──────────────┐                  │
│  │ test-users   │ │test-academic │                  │
│  └──────────────┘ └──────────────┘                  │
│  ┌──────────────┐ ┌──────────────┐                  │
│  │  test-api    │ │test-frontend │                  │
│  └──────────────┘ └──────────────┘                  │
└───────────────────────┬─────────────────────────────┘
                        │ (todos pasan)
┌───────────────────────▼─────────────────────────────┐
│  ETAPA 2 – SAST / Análisis de código (paralelo)     │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │
│  │ sast-users  │ │sast-academic │ │  sast-api   │  │
│  └──────────────┘ └──────────────┘ └─────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│  ETAPA 3 – BUILD de imágenes Docker                 │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│  ETAPA 4 – SCA / Escaneo de vulnerabilidades        │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │
│  │trivy-users  │ │trivy-academic│ │  trivy-api  │  │
│  └──────────────┘ └──────────────┘ └─────────────┘  │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│  ETAPA 5 – SMOKE TESTS (verificación E2E)           │
└─────────────────────────────────────────────────────┘
```

---

## ¿Qué hace cada etapa?

### 🧪 Tests (4 jobs en paralelo)
Cada microservicio instala sus dependencias y ejecuta sus pruebas unitarias de forma independiente. Si un test falla, el pipeline se detiene y no avanza.

| Job | Servicio | Puerto |
|-----|----------|--------|
| `test-users-service` | Autenticación (JWT + bcrypt) | 3001 |
| `test-academic-service` | Cursos académicos | 3002 |
| `test-api-gateway` | Enrutador de peticiones | 3000 |
| `test-frontend` | Interfaz React | 5173 |

### 🔍 SAST – Análisis Estático de Seguridad
Usa **Semgrep** para revisar el código fuente en busca de patrones inseguros (inyecciones, secretos expuestos, etc.) antes de construir las imágenes. Los 3 servicios backend se analizan en paralelo.

### 🐳 Docker Build
Construye las imágenes Docker de todos los servicios usando `docker compose build`. Las imágenes se comprimen y se comparten con las etapas siguientes como artefactos del pipeline.

### 🛡️ SCA – Análisis de Dependencias (Trivy)
Usa **Trivy** para escanear cada imagen Docker en busca de vulnerabilidades conocidas (CVEs). El pipeline solo falla si encuentra vulnerabilidades **CRÍTICAS** — las HIGH son riesgo aceptado documentado. Los 4 servicios se escanean en paralelo.

### 💨 Smoke Tests
Levanta todos los servicios con `docker compose up` y verifica que el sistema funciona de extremo a extremo:
1. **Health check**: `GET /health` del API Gateway.
2. **Login real**: `POST /auth/login` con usuario de prueba → recibe JWT.
3. **Acceso autenticado**: `GET /courses` con el JWT → recibe lista de cursos.

---

## Microservicios del proyecto

```
frontend (React + Vite)
    │  HTTP :5173
    ▼
api-gateway (:3000)
    ├──► users-service (:3001)   →  Autenticación (usuario mock en memoria)
    └──► academic-service (:3002) →  Cursos (datos mock en memoria)
```

Todos los servicios corren en una red Docker interna (`backend-net`). Solo el gateway y el frontend exponen puertos al exterior.

---

## Variables de entorno requeridas

Copia los archivos de ejemplo para desarrollo local:

```bash
cp backend/users-service/.env.example  backend/users-service/.env
cp backend/academic-service/.env.example backend/academic-service/.env
cp backend/api-gateway/.env.example    backend/api-gateway/.env
cp frontend/.env.example               frontend/.env
```

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto donde corre el servicio |
| `JWT_SECRET` | Clave para firmar los tokens de autenticación |
| `USERS_SERVICE_URL` | URL del users-service (solo para api-gateway) |
| `ACADEMIC_SERVICE_URL` | URL del academic-service (solo para api-gateway) |
| `VITE_API_URL` | URL del api-gateway (solo para el frontend) |

---

## Ejecución local

```bash
# Backend (cada servicio en una terminal)
cd backend/users-service   && npm run dev
cd backend/academic-service && npm run dev
cd backend/api-gateway      && npm run dev

# Frontend
cd frontend && npm run dev
```

O con Docker:

```bash
docker compose -f backend/docker-compose.yml up --build
```

---

## Credenciales de prueba

| Campo | Valor |
|-------|-------|
| Email | `admin@test.cl` |
| Contraseña | `123456` |
