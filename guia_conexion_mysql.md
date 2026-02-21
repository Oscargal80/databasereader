# Guía de Conexión: MySQL (cPanel) 🐬

Para conectar tu base de datos MySQL alojada en un cPanel (como la de `binariaos.com.py`), sigue estos pasos:

## 1. Configuración Previa en cPanel (IP Whitelist) 🛡️
Por seguridad, los servidores cPanel bloquean conexiones externas a MySQL. Debes habilitar el acceso:
1. Ingresa a tu **cPanel**.
2. Busca la sección **Bases de Datos** > **MySQL Remoto** (Remote MySQL).
3. En **Añadir anfitrión de acceso**, ingresa la dirección IP de la máquina donde está corriendo el **Backend de Node.js**.
    - *Nota: Si estás usando Cloudflare Tunnel, ingresa la IP del servidor donde instalaste el conector.*
4. Haz clic en **Añadir anfitrión**.

## 2. Completar el Login en la App 🖥️
En la pantalla de inicio de nuestra aplicación, completa los campos así:

| Campo | Valor |
| :--- | :--- |
| **Database Type** | `MySQL` |
| **Host / IP** | `binariaos.com.py` (o `51.79.42.179`) |
| **Port** | `3306` (puerto por defecto de MySQL) |
| **Database Name** | `binariaos_algofrio` |
| **User** | `binariaos_algofrio` |
| **Password** | `xxxx` (tu contraseña de la DB) |

## 3. Consideraciones Importantes (Cloudflare Proxy) ☁️
Si tu dominio `binariaos.com.py` está en Cloudflare con la **nube naranja (Proxy)** activada:
- **El puerto 3306 estará bloqueado** por defecto (solo se permite tráfico HTTP/S).
- **Solución**: Crea un subdominio específico (ej: `direct.binariaos.com.py`) que apunte a la misma IP (`51.79.42.179`) pero con la **nube gris (DNS Only)**. Úsalo en el campo "Host" de la app.

## 4. Otros detalles ⚠️
- **Usuario de DB**: Asegúrate de que el usuario `binariaos_algofrio` tenga privilegios asignados a la base de datos `binariaos_algofrio` dentro de cPanel.
- **Firewall**: Asegúrate de que el puerto `3306` no esté bloqueado por un firewall de red o de software (iptables/csf) en el servidor de destino.

---
*Esta guía fue generada para el entorno de BinariaOS.*
