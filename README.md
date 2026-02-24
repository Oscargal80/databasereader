# SQL Copilot Admin v2.3.2-patch 💎

**© Copyright BinariaOS 2026.** All rights reserved.

Más que un gestor de bases de datos, un **Copiloto SQL Multibase** profesional impulsado por IA. Diseñado para simplificar la gestión compleja de múltiples motores mediante lenguaje natural, análisis inteligente y herramientas de edición masiva.

## 🚀 Diferenciador Real: IA & Productividad

Esta versión eleva la herramienta a una solución enterprise:
- **SQL Copilot (NL-to-SQL)**: Escribe peticiones en lenguaje natural y obtén SQL optimizado para Firebird, Postgres, MySQL, etc.
- **Smart Optimizer (Explainer)**: Análisis profundo de planes de ejecución indicando cuellos de botella y sugiriendo índices.
- **Herramientas Masivas**: 
    - **Fetch All**: Carga de millones de registros sin paginación para auditorías rápidas.
    - **Find & Replace**: Búsqueda y reemplazo masivo de datos mediante SQL eficiente.
15: 
16: ### 🆕 Novedades en v2.3.2-patch: Estabilidad Total
17: 
18: Esta actualización técnica se centra en la robustez para entornos de producción:
19: - **Escritura ASAR-Safe**: Redirección de archivos `settings.json`, `queries.json` y licencias a la carpeta de datos de usuario nativa (`userData`), evitando cierres inesperados en binarios de producción.
20: - **Diagnóstico de IA**: Alertas visuales detalladas para fallos de conexión con OpenAI/Gemini (ej: API deshabilitada o cuotas excedidas).
21: - **Fix UI Executor**: Resolución del error de referencia que bloqueaba la ejecución de SQL en versiones compiladas.
22: - **Health Check**: Nuevo endpoint `/api/ping` para verificación rápida de conectividad del backend.

## ✨ Características Principales

- **Multi-Motor Total**: Soporte nativo para **Firebird, PostgreSQL, MySQL, SQL Server y SQLite**.
- **Explorador Visual Pro**: 
    - **Diagrama ER Interactivo**: Visualiza tablas y relaciones dinámicamente.
    - **Mapa de Dependencias**: Navega por triggers y procedimientos visualmente.
- **Gestión Avanzada**:
    - **Inline CRUD**: Edición y borrado directo desde las tablas de resultados.
    - **User Management**: Gestión de usuarios y contraseñas de base de datos.
    - **Host & DB Info**: Panel detallado de estado del servidor y versiones del motor.
- **Importador Inteligente**: Importa datos desde Excel directamente a tus tablas.

## 🚀 Guía de Instalación

### 1. Preparación del Frontend
- Instalar dependencias: `npm install`
- Ejecutar `npm run build`.
- Copiar `dist/*` a `backend/frontend-dist/`.

### 2. Configuración del Backend
- Instalar dependencias: `npm install`
- Configurar `.env` con las claves de IA (OpenAI/Gemini).
- Iniciar: `npm start` o `npm run dev` para desarrollo.

### 3. Distribución
- **Desktop**: `npm run app:build` para generar binarios (Mac/Win/Linux).

## 🛠️ Tecnologías
- **Frontend**: React 19, Zustand, Material UI 6, React Flow, Recharts.
- **Backend**: Node.js, Express, node-firebird, pg, mysql2, mssql, sqlite3.
- **AI**: OpenAI GPT-4o, Google Gemini 1.5 Pro.

PROXIMO UPDATE, SOPORTE SAP HANA

---
**Desarrollado y mantenido por BinariaOS.**
