# Guía: Cloudflare Tunnel para Acceso VPN

Esta guía te permitirá conectar tu Frontend en cPanel con tu Backend local (que tiene acceso a la VPN).

### 1. Instalar Cloudflare Tunnel
En tu Mac, abre una terminal y corre:
```bash
brew install cloudflared
```

### 2. Crear un Túnel con nombre (Más estable)
Como el túnel rápido (`trycloudflare.com`) parece estar bloqueado por tu DNS/VPN, lo mejor es usar un túnel con nombre en tu cuenta de Cloudflare:

1. Ve a tu panel de Cloudflare -> **Zero Trust** -> **Networks** -> **Tunnels**.
2. Haz clic en **Create a Tunnel** y elige **Cloudflared**.
3. Ponle un nombre (ej: `firebird-backend`).
4. En la pestaña de instalación, elige **Mac** y copia el comando que dice `cloudflared service install ...` (pero no lo instales como servicio aún, solo copia el **Token** que aparece en el comando).
5. En tu terminal, corre:
   ```bash
   cloudflared tunnel run --token TU_TOKEN_AQUI
   ```

### 3. Configurar el nombre de dominio
1. En el mismo panel de Cloudflare (Public Hostname), añade uno:
   - **Subdomain**: `api-db` (o el que quieras)
   - **Domain**: `binariaos.com.py`
   - **Service Type**: `HTTP`
   - **URL**: `localhost:5000`
2. Ahora tu backend será accesible en: `https://api-db.binariaos.com.py`

### 4. Actualizar el Frontend
1. En la carpeta `frontend`, abre `.env.production`.
2. Actualiza la URL:
   `VITE_API_URL=https://api-db.binariaos.com.py/api`
3. Genera el build (`npm run build`) y sube a cPanel.

---

### ¿Por qué esto sí funciona?
*   El túnel crea un puente seguro desde los servidores de Cloudflare hasta tu PC.
*   Tu frontend en internet hablará con Cloudflare, y Cloudflare le pasará la orden a tu PC.
*   Tu PC, al estar conectada a la VPN, podrá consultar la base de datos y devolver los resultados.
