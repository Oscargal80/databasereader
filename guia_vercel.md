# Guía de Despliegue en Vercel (Híbrido)

Para este proyecto, la mejor estrategia es un **despliegue híbrido**. Esto se debe a que tu base de datos Firebird requiere una VPN que solo tu red local (o un VPS configurado) conoce.

## Arquitectura Recomendada

1.  **Frontend (Vercel)**: El Dashboard y las vistas de React se alojan en Vercel. Son rápidos y públicos.
2.  **Backend (Local/PC)**: El servidor Node.js corre en tu PC (donde la VPN está activa). 
3.  **Puente (Cloudflare Tunnel)**: Usamos el túnel que configuramos para que Vercel pueda hablar con tu PC de forma segura.

## Pasos para el Despliegue

### 1. Configurar Vercel (Frontend)
- Sube el código a GitHub/GitLab.
- En Vercel, crea un nuevo proyecto e impórtalo.
- En los **Environment Variables** de Vercel, añade:
  - `VITE_API_URL`: Tu URL de Cloudflare (ej: `https://tu-admin.binaria.com/api`)

### 2. Configurar el Proxy (Opcional)
He creado un archivo `vercel.json` en la raíz. Si lo usas, Vercel reenviará automáticamente todas las llamadas de `/api/*` a tu backend local.
- Edita el archivo `vercel.json` y cambia `TU-TUNEL-CLOUDFLARE.com` por tu URL real.

### 3. Backend (Tu PC)
- Asegúrate de que `node server.js` esté corriendo en tu PC.
- La VPN debe estar conectada para que el backend vea la IP de la base de datos Firebird.

## ¿Por qué no poner el Backend en Vercel?
- **VPN**: Vercel no tiene acceso a tu VPN local.
- **Firebird**: El driver de Firebird a veces requiere librerías del sistema que no están disponibles en las funciones "Serverless" de Vercel.

Esta configuración te da lo mejor de los dos mundos: la velocidad de Vercel para tus usuarios y la conexión directa a tu base de datos privada desde tu backend.
