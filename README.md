<p align="center">
  <img src="logo.png" width="150" alt="Universal DB Admin Logo">
</p>

# Universal DB Admin v2.0 🚀

**© Copyright BinariaOS 2026.** All rights reserved.

Una herramienta web administrativa de nivel empresarial, diseñada para gestionar múltiples motores de bases de datos simultáneamente. Incorpora asistentes de IA, arquitectura escalable y optimizaciones para el procesamiento masivo de datos.

## 🚀 Novedades de la Versión 2.0
- **Gestión de Estado Global Avanzada**: Implementación de `Zustand` para el manejo de preferencias persistentes (Modos de Tema, Posición de Sidebars), logrando un control de estado libre de renders innecesarios.
- **Gráficas Analíticas en Dashboard**: Incorporación de `Recharts` nativo para diagramar en tiempo real la arquitectura métrica del motor actual conectado.
- **Streaming HTTP para Exportaciones**: Sistema de exportación optimizado (Big Data safe) usando Node.js streams para exportar archivos CSV colosales directamente por red a la memoria nativa del navegador, evadiendo fallos técnicos por desbordamiento RAM. 
- **Refactorización Componentizada**: Desacoplamiento de vistas masivas (`CRUD.jsx`, `Login.jsx`) en arquitecturas UI atómicas y reusables para una estabilidad superior.
- **Arquitectura Optimizada**: Caché local de memoria (`node-cache`) inserto en el árbol del explorador para proveer búsquedas ultrarrápidas de esquemas profundos.

## ✨ Características Principales

- **Multi-Motor Total**: Soporte nativo para **Firebird, PostgreSQL, MySQL, SQL Server y SQLite**.
- **Asistente SQL con IA**: Genera consultas complejas usando lenguaje natural procesado por LLMs.
- **Explorador de Metadatos Avanzado**: 
    - Navegación completa por **Tablas, Vistas, Procedimientos, Triggers y Generadores**.
    - **Pestaña "Source Code"**: Visualiza el DDL directamente de objetos read-only.
- **CRUD Dinámico Total**: Gestión de datos con formularios auto-generados y acciones rápidas contextuales (Copy as INSERT, UPDATE o Headers TSV).
- **Librería de Consultas**: Guarda tus queries favoritas en una biblioteca de ejecución asíncrona persistente.

## 🌐 Conectividad y Uso de VPN

Esta herramienta está optimizada para bases de datos privadas mediante:
- **VPN Corporativa**: El backend actúa como puente de confianza ciego.
- **Cloudflare Tunnel**: Conexión cifrada zero-trust sin abrir puertos en el router origen.

## 🚀 Guía Exhaustiva de Producción (Go-Live)

Siga con precisión los siguientes lineamientos para desplegar esta plataforma en la red empresarial:

### 1. Preparación del Frontend (React / Vite)
- Edite o genere asertivamente el entorno de producción (`.env.production`) declarando `VITE_API_URL` apuntando a su Node.js en vivo.
- Ejecute la orden `npm run build` en el espacio de trabajo del `frontend/`.
- El build está programado estructuralmente con `base: './'`, lo que hace viable su despliegue en un sub-path u origen relativo sin comprometer el routing.
- Ubicado en `/dist`, hay provisto un subarchivo `.htaccess` calibrado herméticamente para **Apache** que maneja el SPA fallback (Index routing) y un Proxy Reverso transparente estandarizado hacia el puerto `/api`.

### 2. Configuración del Backend (Node.js)
- Valide el `.env` del directorio principal del back conteniendo claves maestras de IA (OpenAI/Google).
- **Requisito mandatorio:** Implemente `PM2`, o similar gestor subyacente para contener al clúster de Express:
  ```bash
  pm2 start server.js --name "universal-db-backend-v2"
  ```
- Por omisión, este motor despachador inicia escucha TCP en el puerto `5000`.

### 3. Seguridad Perimetral
- **Autenticación Base**: Sesiones almacenadas exclusivamente desde el pool del Server Node, asegurando que las inyecciones CSRF frontales sean inoperativas.
- **CORS Estricto**: Declare orígenes precisos en el archivo middleware fundamental al desplegar a dominios reales.

## 🛠️ Tecnologías Empleadas

- **Frontend**: React 19 (Vite), Zustand, Recharts, Material UI v6/v7 (Grid v2), i18next, Axios.
- **Backend**: Node.js, Express, node-cache, node-firebird, pg, mysql2, mssql, sqlite3.

---
**Desarrollado y mantenido por BinariaOS.**
