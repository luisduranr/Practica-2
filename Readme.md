# Arquitectura DevSecOps v2

Este proyecto implementa un pipeline CI/CD con seguridad integrada (**DevSecOps**) que automatiza desde la validación del código hasta el despliegue en producción. Todo corre sobre infraestructura **local** usando servidores Debian virtualizados, sin depender de servicios cloud de pago. Cada push a `main` activa el pipeline completo automáticamente.

---

## Infraestructura de Servidores

| Servidor | IP | Rol | Por qué |
|---|---|---|---|
| **debian1** | `192.168.122.5` | Runner CI/CD + SonarQube | Ejecuta todos los jobs del pipeline localmente. Self-hosted: sin límite de minutos, acceso a red local, SonarQube alcanzable sin exponer a internet |
| **debian2** | `192.168.122.6` | Servidor de producción | Recibe el despliegue automático via Ansible. Entorno de producción real, aislado del servidor de build |

```
Tu máquina (dev)
      │ git push
      ▼
  GitHub (repositorio)
      │ webhook trigger
      ▼
  debian1 (192.168.122.5) ──── SonarQube :9000
  ├── GitHub Actions Runner
  ├── Docker daemon
  └── Ansible controller
            │ ansible-playbook (SSH)
            ▼
  debian2 (192.168.122.6)
  └── Docker (producción)
        ├── frontend          :80
        ├── api-gateway       :3000
        ├── users-service     :3001
        └── academic-service  :3002
```

---

## Justificación Técnica de Decisiones

Cada herramienta del pipeline responde **qué hace, en qué fase DevSecOps actúa, qué riesgo mitiga y por qué es necesaria aunque el sistema ya funcione.**

### 1. Tests Unitarios — `Jest`

| Atributo | Detalle |
|---|---|
| **Herramienta** | Jest (framework de testing para Node.js) |
| **Fase DevSecOps** | **Develop** — primera línea de defensa antes de integrar código |
| **Riesgo que mitiga** | Regresiones funcionales: cambios que rompen comportamiento existente sin que el desarrollador lo note |
| **Por qué es necesaria** | Un sistema funcional hoy puede dejar de serlo con cualquier cambio. Sin tests automatizados, la integración continua carece de garantía de calidad mínima. |

### 2. SAST — `Semgrep`

| Atributo | Detalle |
|---|---|
| **Herramienta** | Semgrep instalado en `venv` Python aislado |
| **Fase DevSecOps** | **Build** — análisis del código fuente sin ejecutarlo |
| **Riesgo que mitiga** | Vulnerabilidades de código: inyecciones, secretos expuestos, uso inseguro de APIs criptográficas |
| **Por qué es necesaria** | Los desarrolladores no detectan todos los patrones inseguros manualmente. Semgrep analiza el 100% del código en cada push. El `venv` aísla las dependencias sin contaminar el entorno Python del runner. |

### 3. SAST — `SonarQube`

| Atributo | Detalle |
|---|---|
| **Herramienta** | SonarQube Community `192.168.122.5:9000` + `sonarqube-scan-action` |
| **Fase DevSecOps** | **Build** — análisis de calidad y seguridad con historial acumulado |
| **Riesgo que mitiga** | Deuda técnica, código duplicado, cobertura insuficiente de tests, vulnerabilidades de código con contexto histórico |
| **Por qué es necesaria** | Complementa a Semgrep con métricas de calidad, tendencias y dashboard visual. Al estar en la red local, el runner lo alcanza sin exponer la instancia a internet. |

### 4. Build de Imágenes Docker

| Atributo | Detalle |
|---|---|
| **Herramienta** | Docker + Docker Compose + Buildx |
| **Fase DevSecOps** | **Package** — empaquetado del artefacto desplegable |
| **Riesgo que mitiga** | Inconsistencia entre entornos: "funciona en mi máquina". El artefacto es idéntico en CI y producción |
| **Por qué es necesaria** | Las imágenes quedan en el daemon Docker local del runner — sin comprimir ni subir a GitHub Artifacts. Más rápido, sin límites de tamaño. Son la base para que Trivy escanee. |

### 5. SCA — `Trivy`

| Atributo | Detalle |
|---|---|
| **Herramienta** | Trivy (Aqua Security), matrix de 4 servicios en paralelo |
| **Fase DevSecOps** | **Test de Seguridad** — escaneo de imagen antes del despliegue |
| **Riesgo que mitiga** | CVEs en dependencias de Node.js, paquetes del sistema Alpine y binarios de la imagen |
| **Por qué es necesaria** | El 80% de vulnerabilidades modernas vienen de dependencias, no del código propio. Una librería puede volverse vulnerable días después de instalarse. Trivy consulta bases de datos de CVEs actualizadas en cada ejecución. Bloqueante solo en `CRITICAL` para evitar fatiga de alertas. |

### 6. Smoke Tests E2E

| Atributo | Detalle |
|---|---|
| **Herramienta** | `curl` contra el stack completo levantado con `docker compose up --no-build` |
| **Fase DevSecOps** | **Verify** — verificación de integridad del sistema integrado |
| **Riesgo que mitiga** | Fallos de integración: servicios que funcionan en aislamiento pero fallan al comunicarse (red, JWT, variables de entorno) |
| **Por qué es necesaria** | Las pruebas unitarias verifican componentes en aislamiento. Los smoke tests verifican el sistema completo: health check → login → acceso autenticado a recursos. |

### 7. Publish — `Docker Hub`

| Atributo | Detalle |
|---|---|
| **Herramienta** | `docker tag` + `docker push` → `luisfer34/devsecops-ucb` |
| **Fase DevSecOps** | **Release** — publicación del artefacto validado |
| **Riesgo que mitiga** | Despliegue de imágenes no validadas o sin trazabilidad de versión |
| **Por qué es necesaria** | Solo llega aquí si **todas** las etapas anteriores pasaron. Cada imagen se publica con el SHA del commit (`<servicio>-<sha>`) y con `latest`, garantizando auditabilidad. Después del push limpia las imágenes del runner sin afectar otros servicios. |

### 8. Deploy — `Ansible`

| Atributo | Detalle |
|---|---|
| **Herramienta** | `ansible-playbook` desde debian1 hacia debian2 via SSH |
| **Fase DevSecOps** | **Deploy** — despliegue automático en producción |
| **Riesgo que mitiga** | Despliegues manuales propensos a error, inconsistencia entre entornos, falta de verificación post-despliegue |
| **Por qué es necesaria** | Ansible es agentless (solo necesita SSH). Hace `docker pull` de la imagen publicada en Docker Hub, aplica la configuración de producción con IPs explícitas y verifica el health check antes de declarar éxito. Terraform fue descartado porque es para crear infraestructura, no para configurar servidores existentes. |

---

## Flujo Completo del Pipeline

```
[git push a main]
        │
        ▼
┌─────────────────────────────────────────┐
│  ETAPA 1 – TESTS (4 jobs en paralelo)   │
│  users-service · academic · api · front │
└──────────────┬──────────────────────────┘
               │ todas pasan
┌──────────────▼──────────────────────────┐
│  ETAPA 2+3 – SAST (paralelo)            │
│  ┌─────────────────┐ ┌───────────────┐  │
│  │  Semgrep ×3     │ │ SonarQube ×4  │  │
│  │  (venv Python)  │ │ :9000 local   │  │
│  └─────────────────┘ └───────────────┘  │
└──────────────┬──────────────────────────┘
               │ ambos pasan
┌──────────────▼──────────────────────────┐
│  ETAPA 4 – DOCKER BUILD                 │
│  docker compose build (4 imágenes)      │
│  Imágenes en daemon local de debian1    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  ETAPA 5 – TRIVY SCA (4 en paralelo)    │
│  users · academic · gateway · frontend  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  ETAPA 6 – SMOKE TESTS E2E              │
│  health check → login → /courses        │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  ETAPA 7 – PUBLISH → Docker Hub         │
│  luisfer34/devsecops-ucb:<sha>+latest   │
│  + limpieza quirúrgica en debian1       │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  ETAPA 8 – DEPLOY via Ansible           │
│  debian2: docker pull + compose up      │
│  health check final ✅                  │
└─────────────────────────────────────────┘
```

---

## Microservicios del Sistema

| Servicio | Puerto | Tecnología | Función |
|---|---|---|---|
| `frontend` | 80 (prod) / 5173 (dev) | React 19 + Vite + Nginx | Interfaz de usuario |
| `api-gateway` | 3000 | Node.js + Express | Enrutador y validación JWT |
| `users-service` | 3001 | Node.js + bcrypt | Autenticación |
| `academic-service` | 3002 | Node.js | Gestión de cursos |

```
Browser
    │ HTTP :80
    ▼
frontend (React + Nginx)
    │ HTTP :3000
    ▼
api-gateway
    ├──► users-service     :3001  (autenticación + JWT)
    └──► academic-service  :3002  (cursos)
```

En **producción** (debian2) todos los servicios usan IPs explícitas (`192.168.122.6`) en lugar de nombres Docker internos, con puertos expuestos al host.

---

## Decisiones de Arquitectura Clave

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Self-hosted runner en debian1 | GitHub-hosted runners | Sin límite de minutos, acceso a red local, SonarQube alcanzable |
| Imágenes en daemon local (sin upload-artifact) | `docker save` / `upload-artifact` | Más rápido, sin límites de tamaño, mismo runner para todos los jobs |
| `venv` para Semgrep | `pip install` global | Aísla dependencias, no contamina el entorno Python del runner self-hosted |
| SonarQube local + Semgrep | Solo uno de los dos | Semgrep: velocidad en CI. SonarQube: historial, cobertura, dashboard |
| Ansible para deploy | Terraform / SSH directo | Agentless, declarativo, idempotente — para configurar servidores existentes |
| `.env.production` en Vite | Variable de runtime | Vite compila env vars en build time; el browser necesita la IP pública, no el hostname Docker |
| IPs explícitas en producción | DNS internos de Docker | Compatibilidad con accesos externos; los nombres Docker solo son resolvibles dentro de la red |

---

## Secrets de GitHub configurados

| Secret | Etapa | Descripción |
|---|---|---|
| `SONAR_TOKEN` | SonarQube | Token de análisis generado en SonarQube Admin |
| `SONAR_HOST_URL` | SonarQube | `http://192.168.122.5:9000` |
| `DOCKERHUB_USERNAME` | Publish | Usuario de Docker Hub (`luisfer34`) |
| `DOCKERHUB_TOKEN` | Publish | Access Token de Docker Hub (Read & Write) |
| `DEPLOY_SSH_KEY` | Deploy | Clave privada SSH para acceder a debian2 como `luis` |
| `JWT_SECRET` | Deploy | Clave secreta JWT para el entorno de producción |

---

## Variables de Entorno (Desarrollo Local)

```bash
cp backend/users-service/.env.example   backend/users-service/.env
cp backend/academic-service/.env.example backend/academic-service/.env
cp backend/api-gateway/.env.example     backend/api-gateway/.env
cp frontend/.env.example                frontend/.env
```

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servicio |
| `JWT_SECRET` | Clave para firmar tokens de autenticación |
| `USERS_SERVICE_URL` | URL del users-service (solo para api-gateway) |
| `ACADEMIC_SERVICE_URL` | URL del academic-service (solo para api-gateway) |
| `VITE_API_URL` | URL del api-gateway (solo para el frontend) |

> En producción, las URLs usan IPs explícitas (`http://192.168.122.6:puerto`). En desarrollo local usan nombres Docker internos (`http://users-service:3001`).

---

## Ejecución Local

```bash
# Sin Docker — cada servicio en una terminal
cd backend/users-service    && npm run dev
cd backend/academic-service && npm run dev
cd backend/api-gateway      && npm run dev
cd frontend                 && npm run dev

# Con Docker Compose
docker compose -f backend/docker-compose.yml up --build
```

---

## Credenciales de Prueba

| Campo | Valor |
|---|---|
| Email | `admin@test.cl` |
| Contraseña | `123456` |
