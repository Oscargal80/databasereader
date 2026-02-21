# Universal DB Admin (Firebird, Postgres, MySQL & SQLite)

Una potente herramienta administrativa web para gestionar múltiples motores de bases de datos de forma dinámica, con asistente de IA integrado, importador de Excel y visualización avanzada de esquemas.

## 🚀 Características Principales

- **Multi-Motor**: Soporte nativo para Firebird, PostgreSQL, MySQL y SQLite.
- **Asistente SQL con IA**: Genera consultas complejas usando lenguaje natural (compatible con OpenAI GPT-4o y Google Gemini 1.5 Flash).
- **Explorador de Esquemas**: Visualiza tablas, vistas, procedimientos, disparadores e índices.
- **CRUD Dinámico**: Gestión de datos (Ver, Insertar, Eliminar) con generación automática de formularios.
- **Consola SQL Avanzada**: Editor con resaltado y exportación de resultados a Excel.
- **Librería de Consultas**: Guarda y reutiliza tus queries SQL favoritas.
- **Arquitectura Híbrida**: Diseñado para conectar con bases de datos privadas mediante VPN/Túneles de forma segura.

## 🌐 Conectividad y Uso de VPN

Esta herramienta está diseñada específicamente para entornos donde la base de datos no está expuesta a internet. Aquí se detallan los casos de uso de VPN:

### 1. Acceso a Bases de Datos Corporativas (Firebird/Postgres/MySQL)
Si tu base de datos reside en un servidor interno o en una oficina remota:
- **VPN Cliente**: Debes tener activa la VPN (ej. FortiClient, Cisco AnyConnect, WireGuard) en la máquina donde se ejecuta el **Backend de Node.js**.
- **Backend como Puente**: El backend actúa como un proxy. El frontend puede estar en la nube (Vercel/Netlify), pero el backend debe estar en una red que "vea" la IP de la base de datos.

### 2. Cloudflare Tunnel (Alternativa a VPN Tradicional)
Si quieres acceder desde cualquier lugar sin mantener una VPN cliente encendida en tu dispositivo personal:
- Instala `cloudflared` en el servidor de la oficina.
- Crea un túnel que exponga el puerto `5000` (Backend).
- Conecta el Frontend a la URL de Cloudflare (ej. `https://api-db.tu-dominio.com`).
- El backend, al estar dentro de la red local, podrá conectar a las bases de datos internas por sus IPs privadas.

### 3. Bases de Datos en la Nube con Whitelist
Para bases de datos en AWS/Azure que requieren IP estática:
- El backend puede ejecutarse en un VPS con IP fija o mediante una VPN con salida de IP estática para cumplir con las reglas de firewall del motor.

## 🛠️ Tecnologías

- **Frontend**: React (Vite), Material UI (MUI), Axios, XLSX.
- **Backend**: Node.js, Express, `node-firebird`, `pg`, `mysql2`, `sqlite3`.
- **IA**: OpenAI API, Google Generative AI SDK.

## 📋 Requisitos Previos

- Node.js (v18 o superior recomendado).
- Servidor de base de datos accesible (Local, VPN o Red Local).
- (Opcional) API Keys para OpenAI o Google Gemini.

## 🔧 Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/nombre-repo.git
cd nombre-repo
```

### 2. Configurar el Backend
```bash
cd backend
npm install
cp .env.example .env
# Edita .env con tus claves de IA si deseas usar el Asistente
node server.js
```

### 3. Configurar el Frontend
```bash
cd ../frontend
npm install
cp .env.example .env.local
# Inicia en modo desarrollo
npm run dev
```

## 🌐 Despliegue (Estrategia Recomendada)

Para bases de datos protegidas por firewall:

1.  **Backend**: Ejecutar en el servidor/PC que tiene acceso directo o mediante VPN a las bases de datos.
2.  **Frontend**: Generar el build (`npm run build`) y alojar en cualquier servidor estático (Vercel, cPanel, Firebase Hosting).
3.  **Configuración API**: Ajustar `VITE_API_URL` en el frontend para apuntar a la dirección (o túnel) de tu backend.

## 👨‍💻 Seguridad
- Las credenciales de base de datos se manejan mediante sesiones cifradas en el servidor.
- No se almacenan contraseñas de DB de forma persistente.
- Soporte para cookies `secure` y `SameSite: none` para arquitecturas multinivel.

---
Diseñado para administradores que necesitan rapidez y potencia en entornos corporativos.
