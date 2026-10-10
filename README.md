# ⚡ Unsk1ngMD

Un asistente multifuncional para WhatsApp enfocado en alto rendimiento, dinamismo, bajo consumo de memoria RAM y utilidades multimedia. Construido sobre Node.js y la librería [@whiskeysockets/baileys](https://github.com/whiskeysockets/baileys).

**Desarrollador:** Castrodev  
**Versión:** 1.0.0  
**Licencia:** MIT  

---

## 📌 Funcionalidades Destacadas

- 🎵 **Descargas Multimedia:** Procesamiento y extracción en alta definición (YouTube 720p/MP3 con `yt-dlp` y `FFmpeg`, TikTok sin marca de agua, Instagram Reels, Facebook HD, Twitter/X y Pinterest).
- 🧠 **Enciclopedia & Conocimiento:** Consultas de información directa con `.wiki` potenciadas por **Groq Cloud AI** (`Llama 3.3` / `Llama 3.1`), con explicaciones rigurosas y estructuradas.
- 🛡️ **Seguridad para Grupos:** Herramientas de moderación automática para control de enlaces (`.antilink`), protección contra ráfagas de spam (`.antispam` / `.antispamkick`) y bienvenida personalizada con nota de voz PTT oficial (`.bienvenido/a`).
- 🎲 **Juegos & Dinámicas:** Modos interactivos en tiempo real como trivias de opción múltiple, ruleta rusa grupal, Akinator y acertijos sin frustración por acentos.
- ⚡ **Multi-Sesión de Sub-Bots:** Vinculación mediante código de emparejamiento de 8 dígitos (`.code` / `.subbot`), monitoreo activo (`.subbot list`) y desconexión segura (`.subbot stop`).
- ⚙️ **Utilidades del Sistema:** Información detallada de números con operador y geolocalización (`.info`), métricas de consumo de memoria RAM en vivo y contacto directo del creador.

---

## 🚀 Despliegue Rápido & Plug & Play

**Unsk1ngMD** está diseñado con una arquitectura **100% Plug & Play**:
* ❌ **Sin Python:** No requiere Python ni gestores externos a nivel de sistema operativo.
* ❌ **Sin compilación nativa:** Cero dependencias `node-gyp`.
* ❌ **Sin paquetes de sistema:** No requiere `apt-get install ffmpeg` ni `apk add`. El binario de FFmpeg está autocontenido (`ffmpeg-static`) y `yt-dlp` se descarga y actualiza de forma autónoma en `./bin/`.

### 🎮 Despliegue en Contenedores Docker / Pterodactyl Panel

1. **Configuración del Egg en Pterodactyl:**
   - Selecciona un Egg oficial o estándar de **Node.js** (versión **18**, **20** o **22**). Totalmente compatible tanto con imágenes basadas en Debian/Ubuntu (`glibc`) como en Alpine Linux (`musl`).
   - En la sección **Startup (Configuración de arranque)** del panel:
     - **Main File (Archivo de inicio):**
       ```bash
       index.js
       ```

2. **Estructura de Archivos en el Contenedor:**
   - Asegúrate de que todos los archivos del bot se encuentren directamente en la raíz `/home/container/` (ej: `/home/container/index.js`, `/home/container/package.json`) y **NO** dentro de una subcarpeta como `/home/container/Unsk1ngMD/`.

3. **Instalación Limpia de Dependencias:**
   - En la consola o terminal del contenedor, ejecuta:
     ```bash
     npm install
     ```
   *(El archivo `package-lock.json` provisto resuelve todas las librerías 100% desde el registro oficial de npmjs.org, garantizando cero bloqueos por `EALLOWGIT` o Git SSH).*

4. **Variables de Entorno (.env):**
   - Configura tus credenciales (`GROQ_API_KEY`, `OWNER_NUMBER`, etc.) en el archivo `.env`. Si no lo creas manualmente, el módulo de inicio rápido creará uno automáticamente basado en `.env.example`.

5. **Arranque e Inicio:**
   - Enciende el servidor desde el panel. Durante el primer arranque, selecciona en la consola el método de vinculación (Código QR o Pairing Code de 8 dígitos).

---

### 🔧 Solución de Problemas Frecuentes (Troubleshooting)

| Error en Consola | Causa Probable | Solución Definitiva |
| :--- | :--- | :--- |
| `Cannot find module './index.js'` | Los archivos del bot se subieron en una subcarpeta (ej: `/home/container/Unsk1ngMD/`) en lugar de la raíz. | Mueve todos los archivos a `/home/container/` para que `index.js` quede exactamente en la raíz del contenedor. |
| `npm error code EALLOWGIT` | Intentar instalar Baileys sin el `package-lock.json` saneado en un entorno donde Git está bloqueado. | Usa el archivo `package-lock.json` oficial del repositorio y ejecuta `npm install`. Resuelve el 100% de paquetes desde npmjs.org. |
| `node-gyp / Python / gcc not found` | Dependencias obsoletas que requerían compilar binarios C++ localmente. | Solucionado de raíz. El bot no requiere Python ni compiladores nativos; usa `ffmpeg-static` y JS puro. |
| `Permission denied: ./bin/yt-dlp` | El sistema de archivos del contenedor restringió los permisos del binario descargado. | Ejecuta en terminal: `chmod +x bin/yt-dlp` (el bot intenta autoasignar `0o755` de manera automática). |
| `Error: Cannot find module 'dotenv'` | Omitir la instalación de paquetes antes de iniciar el bot. | Ejecuta `npm install` antes de `node index.js`. |

---

### 💻 Despliegue en Servidores VPS / Terminal Local

1. **Clonar el proyecto:**
   ```bash
   git clone https://github.com/Unsk1ngdev/Unsk1ngMD.git
   cd Unsk1ngMD
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar el bot:**
   ```bash
   npm start
   ```

Al iniciar por primera vez, selecciona el método de vinculación en la consola:
- **`[1]` Código QR:** Escanéalo directamente desde WhatsApp (*Dispositivos vinculados > Vincular un dispositivo*).
- **`[2]` Pairing Code (Recomendado):** Ingresa tu número de teléfono con código de país para recibir el código de emparejamiento de 8 dígitos en la terminal.

---

## 📖 Catálogo Completo de Comandos

### 📥 1. Descargas Multimedia
| Comando | Parámetros | Descripción |
| :--- | :--- | :--- |
| `.ytmp4` | `[enlace]` | Descarga video de YouTube/Shorts multiplexado en MP4 (máx. 720p). |
| `.ytmp3` | `[enlace]` | Extrae audio de YouTube y lo convierte a MP3 real de 128k con FFmpeg. |
| `.tiktok` | `[enlace]` | Descarga videos de TikTok en alta definición sin marca de agua. |
| `.instagram` | `[enlace]` | Descarga Reels, videos y publicaciones públicas de Instagram. |
| `.facebook` | `[enlace]` | Descarga videos de Facebook / fb.watch en calidad HD/SD. |
| `.twitter` | `[enlace]` | Descarga clips y videos de Twitter / X en formato MP4. |
| `.pinterest` | `[búsqueda]` | Busca y envía imágenes en alta resolución desde Pinterest. |
| `.gitclone` | `[url repo]` | Clona y descarga el código de un repositorio de GitHub en `.zip`. |

---

### 🎨 2. Stickers y Edición de Medios
| Comando | Parámetros | Descripción |
| :--- | :--- | :--- |
| `.sticker` / `.s` | `[imagen/video]` | Convierte imagen o video corto a Sticker WebP con EXIF oficial. |
| `.gif` | `[video corto]` | Convierte un video o animación a sticker animado ligero. |
| `.toimg` | `[citando sticker]` | Transforma un sticker estático en imagen JPEG limpia. |
| `.tovideo` | `[citando sticker]` | Transforma un sticker animado en video MP4 reproducible. |
| `.tovn` | `[audio/video]` | Transcodifica cualquier audio o video a **nota de voz PTT real de WhatsApp**. |
| `.tomp3` | `[audio/video]` | Extrae y normaliza el audio a MP3 estándar reproducible. |
| `.tourl` | `[citando medio]` | Sube imágenes o videos (< 15MB) a la nube y devuelve un enlace público. |
| `.meme` | - | Envía un meme aleatorio en tendencia de comunidades abiertas. |
| `.cmeme` | `[texto1 \| texto2]` | Genera un meme personalizado con tipografía Impact sobre la imagen citada. |
| `.blur` | `[citando imagen]` | Aplica un filtro de desenfoque gaussiano sobre la imagen. |
| `.qr` | `[texto o enlace]` | Genera una imagen con código QR legible. |
| `.readqr` | `[citando QR]` | Lee y extrae el texto o enlace contenido en una imagen QR. |
| `.screenshot` | `[url]` | Toma una captura de pantalla web completa de una página pública. |

---

### 👥 3. Administración y Moderación de Grupos
| Comando | Parámetros | Descripción |
| :--- | :--- | :--- |
| `.antilink` | `[on / off]` | Elimina enlaces no autorizados y expulsa automáticamente al infractor. |
| `.antispam` | `[on / off]` | Borra mensajes por ráfaga repetida (>5 msgs en 3s) y advierte al miembro. |
| `.antispamkick` | `[on / off]` | Modo estricto de antispam: expulsa directamente al usuario spamer. |
| `.bienvenido/a` | `[on / off]` | Activa saludo con foto de perfil, descripción y nota de voz PTT para nuevos miembros. |
| `.promote` | `[@mención / reply]` | Asciende a un participante al rango de Administrador. |
| `.demote` | `[@mención / reply]` | Degrada a un administrador a participante común. |
| `.kick` / `.ban` | `[@mención / reply]` | Expulsa inmediatamente a un participante del grupo. |
| `.abrir` | - | Configura el grupo para que todos los miembros puedan enviar mensajes. |
| `.cerrar` | - | Restringe el grupo para que únicamente los administradores envíen mensajes. |
| `.tagall` | `[motivo]` | Menciona visiblemente a todos los integrantes del grupo. |
| `.hidetag` | `[mensaje]` | Envía una notificación masiva en segundo plano a todos los participantes. |
| `.notify` | `[aviso]` | Emite un comunicado oficial de administradores fijando la atención. |
| `.linkgroup` | - | Obtiene el enlace de invitación oficial del grupo. |
| `.revoke` | - | Restablece e invalida el enlace de invitación anterior del grupo. |
| `.enviarlink` | `[número]` | Envía el enlace de invitación de forma privada al número especificado. |

---

### 🎮 4. Juegos y Entretenimiento
| Comando | Parámetros | Descripción |
| :--- | :--- | :--- |
| `.trivia` | - | Inicia una trivia de cultura general con 4 opciones (A, B, C, D) y 45s de tiempo. |
| `.akinator` | - | El genio Akinator intentará adivinar el personaje real o ficticio en el que piensas. |
| `.cancelakinator` | - | Cancela de forma inmediata la partida activa de Akinator en el chat. |
| `.ruleta` | - | Ruleta rusa grupal (1 de 6 probabilidad de disparo letal con expulsión del grupo). |
| `.acertijo` | - | Desafío de acertijo con respuestas abiertas, sin frustración por acentos y 60s límite. |

---

### 🧠 5. Herramientas, APIs e Inteligencia Artificial
| Comando | Parámetros | Descripción |
| :--- | :--- | :--- |
| `.wiki` | `[tema]` | Explicaciones enciclopédicas rigurosas y concisas vía **Groq Cloud AI** (`Llama 3.3`). |
| `.ia` | `[pregunta]` | Consulta directa al motor conversacional de IA ultrarrápido con Groq. |
| `.genimg` | `[prompt]` | Genera imágenes de alta fidelidad mediante Inteligencia Artificial. |
| `.info` | `[@mención / núm]` | Consulta profunda: bandera del país, operadora, estado/bio, foto HD y enlace directo. |
| `.calc` | `[operación]` | Calculadora matemática avanzada con soporte de fórmulas y potencias. |
| `.trad` | `[cód] [texto]` | Traductor multilingüe rápido mediante Google Translate (ej: `.trad en Hola`). |
| `.clima` | `[ciudad]` | Reporte del pronóstico meteorológico en tiempo real (temperatura, humedad y viento). |
| `.crypto` | `[moneda]` | Cotización en tiempo real y porcentaje de variación para criptoactivos (BTC, ETH, etc.). |
| `.lyrics` | `[canción]` | Obtiene la letra completa de canciones con su autor y título oficial. |

---

### ⚡ 6. Sub-Bots (Multi-Sesión Independiente)
| Comando | Parámetros | Descripción |
| :--- | :--- | :--- |
| `.code` / `.subbot` | `[número]` | Genera un código de vinculación de 8 dígitos para conectar un Sub-Bot propio. |
| `.subbot list` | - | Lista todos los Sub-Bots conectados al servidor y su tiempo activo en línea. |
| `.subbot stop` | `[número]` | Desconecta la sesión y purga los datos del Sub-Bot indicado. |

---

### ⚙️ 7. Control de Host & Sistema (Dueño / Owner)
| Comando | Parámetros | Descripción |
| :--- | :--- | :--- |
| `.ping` | - | Mide la latencia de respuesta del socket en milisegundos. |
| `.status` | - | Muestra el consumo de memoria RAM (RSS/Heap), tiempo encendido (uptime) y CPU. |
| `.owner` | - | Envía la tarjeta de contacto oficial (vCard) del creador Castrodev. |
| `.menu` | `[categoría]` | Despliega el menú interactivo con portada multimedia y soporte de filtros. |
| `.comandos` | - | Guía detallada con ejemplos prácticos de uso para cada funcionalidad. |
| `.prefix` | `[nuevo]` | Cambia el prefijo global del bot en caliente (ej: `.prefix !`). |
| `.mode` | `[public/private]` | Alterna el acceso al bot (público general o exclusivo del dueño). |
| `.restart` | - | Cierra limpiamente los sockets y reinicia el proceso del bot. |
| `.backup` | - | Empaqueta la sesión `auth_info` en un archivo `.zip` seguro y lo envía al chat. |
| `.broadcast` | `[mensaje]` | Difunde un comunicado oficial del dueño a todos los grupos donde esté el bot. |

---

## 🛡️ Ejecución en Producción 24/7 (PM2)

Para mantener el bot ejecutándose permanentemente en un servidor VPS, contenedor o Raspberry Pi con auto-reinicio ante fallos:

```bash
# 1. Instalar PM2 de forma global
npm install -g pm2

# 2. Iniciar el bot con auto-reinicio y límite estricto de memoria RAM
pm2 start index.js --name "unsk1ng-md" --max-memory-restart 300M

# 3. Guardar la configuración para que arranque automáticamente si el servidor se reinicia
pm2 save
pm2 startup
```

Para monitorear los registros y actividad en tiempo real:
```bash
pm2 logs unsk1ng-md
```

Para detener o reiniciar el bot:
```bash
pm2 restart unsk1ng-md
pm2 stop unsk1ng-md
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Desarrollado con dedicación por **Castrodev**.  
Libre para uso personal y comunitario citando los créditos correspondientes.
