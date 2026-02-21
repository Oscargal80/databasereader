# Universal DB Admin (Firebird, Postgres, MySQL & SQLite) 🚀

Una potente herramienta administrativa web para gestionar múltiples motores de bases de datos de forma dinámica, con asistente de IA integrado, biblioteca de consultas y visualización avanzada de metadatos.

## ✨ Características Principales

- **Multi-Motor Total**: Soporte nativo para **Firebird, PostgreSQL, MySQL y SQLite**.
- **Asistente SQL con IA**: Genera consultas complejas usando lenguaje natural (OpenAI GPT-4o o Google Gemini 1.5 Flash).
- **Explorador de Metadatos Avanzado**: 
    - Navegación completa por **Tablas, Vistas, Procedimientos, Triggers y Generadores**.
    - **Pestaña "Source Code"**: Visualiza el DDL y código fuente de Procedimientos y Triggers directamente.
    - **Generadores/Secuencias**: Consulta de valores actuales en tiempo real.
- **CRUD Dinámico**: Gestión de datos (Ver, Insertar, Eliminar) con formularios generados automáticamente según el esquema.
- **Librería de Consultas**: Guarda tus queries SQL favoritas en una biblioteca persistente (excluida de Git por seguridad).
- **Consola SQL Premium**: Editor con resaltado de sintaxis, historial de ejecución y exportación masiva a **Excel**.
- **Arquitectura Híbrida**: Diseñado para entornos seguros, conectando con bases de datos internas mediante VPN o Túneles.

## 🌐 Conectividad y Uso de VPN

Esta herramienta está optimizada para bases de datos privadas que no están expuestas a internet.

### 1. Acceso mediante VPN Corporativa
Si tu base de datos reside en una intranet:
- Activa tu cliente VPN (FortiClient, AnyConnect, etc.) en el servidor donde corre el **Backend**.
- El backend actuará como puente, permitiendo que el frontend (incluso si está en la nube) acceda a los datos de forma segura.

### 2. Cloudflare Tunnel (Estrategia Recomendada)
Para evitar mantener VPNs cliente encendidas:
- Expón solo el puerto del backend (`5000`) mediante un túnel de Cloudflare. 
- Esto permite una conexión cifrada punto a punto sin abrir puertos en tu firewall.

## 🛠️ Tecnologías

- **Frontend**: React (Vite), Material UI (MUI), Axios, XLSX.
- **Backend**: Node.js, Express, `node-firebird`, `pg`, `mysql2`, `sqlite3`.
- **IA**: OpenAI API, Google Generative AI SDK.

## 📋 Requisitos Previos

- Node.js (v18+).
- Motor de DB compatible accesible localmente o vía red.
- (Opcional) API Keys para el asistente de IA.

## 🔧 Instalación Rápida

1. **Backend**:
   ```bash
   cd backend && npm install
   cp .env.example .env # Configura tus claves aquí
   node server.js
   ```

2. **Frontend**:
   ```bash
   cd frontend && npm install
   npm run dev
   ```

## 🛡️ Seguridad y Privacidad
- **Cero Persistencia de Credenciales**: Las contraseñas se manejan en sesiones volátiles cifradas.
- **Git Safety**: Los datos de la librería de consultas (`backend/data/`) están en el `.gitignore` para evitar fugas de información sensible al repositorio público.
- **CORS & Secure Cookies**: Configuración robusta para despliegues en subdominios o entornos híbridos.

---
Diseñado por **BinariaOS** para administradores que buscan potencia y simplicidad en un solo lugar.
