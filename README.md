<p align="center">
  <img src="logo.png" width="150" alt="SQL Copilot Admin Logo">
</p>

# SQL Copilot Admin v2.1 🚀

**© Copyright BinariaOS 2026.** All rights reserved.

Más que un gestor de bases de datos, un **Copiloto SQL Multibase** impulsado por IA. Diseñado para simplificar la gestión compleja de múltiples motores mediante lenguaje natural y análisis inteligente de datos.

## 🚀 Diferenciador Real: IA Integrada

Esta versión transforma la herramienta de un gestor robusto a un asistente inteligente:
- **SQL Copilot (NL-to-SQL)**: Escribe peticiones en lenguaje natural (ej: "Mostrame clientes con saldo > 3M") y obtén el SQL exacto optimizado para tu motor (Firebird, Postgres, MySQL, etc.).
- **Explicación de Resultados con IA**: Al ejecutar una consulta, la IA analiza los datos devueltos y genera un resumen humano con patrones e insights relevantes.
- **Smart Optimizer (DBA Senior)**: Integración nativa con `EXPLAIN`. La IA analiza el plan de ejecución y sugiere índices, reescritura de JOINs y optimizaciones de rendimiento.

## ✨ Características Principales

- **Multi-Motor Total**: Soporte nativo para **Firebird, PostgreSQL, MySQL, SQL Server y SQLite**.
- **Explorador Visual Pro**: 
    - **Diagrama ER Interactivo**: Visualiza tablas y relaciones dinámicamente con `@xyflow/react`.
    - **Mapa de Dependencias**: Navega por la arquitectura de tu base de datos de forma visual.
    - **Heatmap de Uso**: Identifica las tablas con mayor actividad en tiempo real.
- **CRUD Dinámico Total**: Gestión de datos con formularios auto-generados y acciones rápidas contextuales.
- **Librería de Consultas**: Guarda y organiza tus queries favoritas.

## 🚀 Guía de Instalación y Producción

### 1. Preparación del Frontend
- Edite `.env.production` declarando `VITE_API_URL` apuntando a su servidor.
- Ejecute `npm run build` en `frontend/`.
- Copie los archivos de `frontend/dist` a `backend/frontend-dist/`.

### 2. Configuración del Backend
- Configure sus API Keys de OpenAI/Gemini en el `.env` del backend.
- Ejecute `npm start` o use `PM2`:
  ```bash
  pm2 start server.js --name "sql-copilot-backend"
  ```

### 3. Empaquetado Electron (Escritorio)
- Para generar el instalador de escritorio (macOS/Windows):
  ```bash
  cd backend
  npm run app:build
  ```

## 🛠️ Tecnologías Empleadas

- **Frontend**: React 19, Zustand, Recharts, React Flow, i18next, Material UI.
- **Backend**: Node.js, Express, node-cache, node-firebird, pg, mysql2, mssql, sqlite3.
- **IA**: Modelos avanzados de OpenAI y Google Gemini.

---
**Desarrollado y mantenido por BinariaOS.**
