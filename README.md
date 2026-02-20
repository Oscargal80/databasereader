# AI SQL Manager (Firebird & PostgreSQL)

Una potente herramienta administrativa web para gestionar bases de datos Firebird y PostgreSQL de forma dinámica, con asistente de IA integrado, importador de Excel y visualización avanzada de esquemas.

## 🚀 Características Principales

- **Multi-Base de Datos**: Soporte nativo para Firebird y PostgreSQL.
- **Asistente SQL con IA**: Genera consultas complejas usando lenguaje natural (compatible con OpenAI GPT-4o y Google Gemini 1.5 Flash).
- **Explorador de Esquemas**: Visualiza tablas, vistas, procedimientos, disparadores e índices.
- **CRUD Dinámico**: Gestión de datos (Ver, Insertar, Eliminar) con generación automática de formularios.
- **Consola SQL Avanzada**: Editor con resaltado y exportación de resultados a Excel.
- **Importador Excel**: Carga masiva de datos desde archivos `.xlsx` con mapeo de columnas.
- **Arquitectura Híbrida**: Diseñado para conectar con bases de datos privadas mediante VPN/Túneles de forma segura.

## 🛠️ Tecnologías

- **Frontend**: React (Vite), Material UI (MUI), Axios, XLSX.
- **Backend**: Node.js, Express, `node-firebird` (JavaScript puro), `pg` (PostgreSQL client).
- **IA**: OpenAI API, Google Generative AI SDK.

## 📋 Requisitos Previos

- Node.js (v18 o superior recomendado).
- Servidor Firebird o PostgreSQL accesible.
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

Para bases de datos protegidas por VPN, se recomienda el uso de **Cloudflare Tunnel** para exponer el backend local de forma segura, permitiendo que el frontend (alojado en Vercel o cPanel) se comunique con él.

1.  **Backend**: Ejecutar en el servidor/PC donde reside la VPN.
2.  **Frontend**: Generar el build (`npm run build`) y alojar en cualquier servidor estático.
3.  **Configuración API**: Ajustar `VITE_API_URL` en el frontend para apuntar a la URL pública de tu túnel.

## 👨‍💻 Seguridad
- Las credenciales de base de datos se manejan mediante sesiones cifradas en el servidor.
- No se almacenan contraseñas de DB de forma persistente.
- Soporte para cookies `secure` y `SameSite: none` para arquitecturas multinivel.

---
Diseñado para administradores que necesitan rapidez y potencia en entornos corporativos.
