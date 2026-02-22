# SQL Copilot Admin - Frontend ⚛️

**SQL Copilot Admin v2.1 Frontend Stack**
**© Copyright BinariaOS 2026.** All rights reserved.

Interfaz premium de **SQL Copilot**, diseñada para ofrecer una terminal visual inteligente y multi-motor. Permite interactuar con bases de datos mediante lenguaje natural, diagramas interactivos y telemetría en tiempo real.

## 🚀 Versión 2.1: El Salto a la IA

- **SQL Copilot Interface**: Nuevo componente de chat integrado en la Consola SQL que traduce requisitos de negocio a consultas técnicas.
- **Visual Database Explorer**: Implementación de **React Flow (@xyflow/react)** para renderizar diagramas ER dinámicos, mapas de relaciones y heatmaps de actividad.
- **Smart Analytics Dashboard**: Telemetría en tiempo vivo usando **Recharts** para monitorear la salud del motor conectado.
- **Infinite Data Streaming**: Exportaciones masivas optimizadas mediante túneles de red directos, eliminando bloqueos del navegador en tablas de gran volumen.

## 🛠️ Stack Tecnológico

- **Core**: [React 19+](https://reactjs.org/)
- **Visualización**: [@xyflow/react](https://reactflow.dev/), [Recharts](https://recharts.org/)
- **Estado Global**: [Zustand](https://zustand-demo.pmnd.rs/)
- **UI Framework**: [Material UI (MUI)](https://mui.com/)
- **Internalización**: [react-i18next](https://react.i18next.com/)

## 🔧 Guía de Desarrollo

### Instalación
```bash
cd frontend
npm install
```

### Ejecución en Desarrollo
Inicia el servidor Vite con HMR (Hot Module Replacement):
```bash
npm run dev
```

### Compilación para Producción
Genera el paquete optimizado en `/dist`:
```bash
npm run build
```

## 🌐 Configuración de Producción

### Base Referencing
El paquete utiliza `base: './'`, lo que permite desplegarlo en cualquier subdirectorio sin configuraciones adicionales de asset resolution.

### Variables de Entorno
Asegúrese de configurar `.env.production` antes del build:
- `VITE_API_URL`: URL del Backend API (ej: `https://api.tudominio.com/api`).

---
Desarrollado por **BinariaOS**.
