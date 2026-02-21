<p align="center">
  <img src="logo.png" width="150" alt="Universal DB Admin Logo">
</p>

# Universal DB Admin v1.1 (Firebird, Postgres, MySQL & SQLite) 🚀

Una potente herramienta administrativa web para gestionar múltiples motores de bases de datos de forma dinámica, con asistente de IA integrado, biblioteca de consultas y visualización avanzada de metadatos.

## 🚀 Novedades en v1.1
- **Interfaz de Login Mejorada**: Diseño responsivo, elegante y alineado a entornos corporativos.
- **Gestión Visual Optimizada**: Renderización de tablas y metadatos (índices, FKs, DDL) totalmente dinámica.
- **Internacionalización**: Soporte nativo para Inglés, Español y Portugués.
- **MUI Grid v2**: Migración completa a la última sintaxis de Material UI para máxima compatibilidad.

## ✨ Características Principales

- **Multi-Motor Total**: Soporte nativo para **Firebird, PostgreSQL, MySQL, SQL Server y SQLite**.
- **Asistente SQL con IA**: Genera consultas complejas usando lenguaje natural.
- **Explorador de Metadatos Avanzado**: 
    - Navegación completa por **Tablas, Vistas, Procedimientos, Triggers y Generadores**.
    - **Pestaña "Source Code"**: Visualiza el DDL directamente.
- **CRUD Dinámico**: Gestión de datos con formularios generados automáticamente.
- **Librería de Consultas**: Guarda tus queries favoritas en una biblioteca persistente.
- **Exportación masiva**: Generación de reportes en **Excel** desde cualquier vista.

## 🌐 Conectividad y Uso de VPN

Esta herramienta está optimizada para bases de datos privadas mediante:
- **VPN Corporativa**: El backend actúa como puente seguro.
- **Cloudflare Tunnel**: Conexión cifrada sin abrir puertos en el firewall.

## 🚀 Guía de Producción (Go-Live)

Para un despliegue exitoso en entornos productivos, sigue estos pasos:

### 1. Preparación del Frontend
- Configura `VITE_API_URL` en tu archivo `.env.production`.
- Ejecuta `npm run build`.
- El build está configurado con `base: './'`, lo que permite alojarlo en cualquier subdirectorio.
- La carpeta `dist` incluye un `.htaccess` pre-configurado para **Apache** que maneja el SPA Routing y el Proxy API.

### 2. Configuración del Backend
- Asegúrate de que las variables de entorno de IA (OpenAI/Google) estén configuradas.
- Usa un gestor de procesos como **PM2** para mantener el servidor vivo:
  ```bash
  pm2 start server.js --name "universal-db-backend"
  ```
- El backend corre por defecto en el puerto `5000`.

### 3. Seguridad
- **Sesiones**: Las credenciales no se guardan en el cliente, residen en sesiones cifradas del lado del servidor.
- **CORS**: Asegúrate de que el backend permita el origen de tu dominio de producción.

## 🛠️ Tecnologías

- **Frontend**: React (Vite), Material UI (MUI v6), Axios, XLSX, i18next.
- **Backend**: Node.js, Express, node-firebird, pg, mysql2, mssql, sqlite3.

---

```text
  _    _ _ml                         _   _____  ____  
 | |  | | (_)                       | | |  __ \|  _ \ 
 | |  | | |_   _____ _ __ ___  __ _ | | | |  | | |_) |
 | |  | | | \ \ / / _ \ '__/ __|/ _` || | | |  | |  _ < 
 | |__| | | |\ V /  __/ |  \__ \ (_| || | | |__| | |_) |
  \____/|_|_| \_/ \___|_|  |___/\__,_||_| |_____/|____/ 
                                                        
            D E S I G N E D   B Y   B I N A R I A O S
```
