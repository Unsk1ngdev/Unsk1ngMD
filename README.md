# ⚡ Unsk1ngMD

Un asistente multifuncional para WhatsApp enfocado en alto rendimiento, dinamismo, bajo consumo de memoria RAM y utilidades multimedia avanzadas. Construido sobre Node.js y la librería [@whiskeysockets/baileys](https://github.com/whiskeysockets/baileys).

**Desarrollador:** Castrodev  
**Versión:** 1.0.0  
**Licencia:** MIT  

---

## 📌 Funcionalidades Destacadas

- 🎵 **Descargas Multimedia:** Extracción y multiplexado en alta definición (YouTube 720p/MP3 con `yt-dlp` y `FFmpeg`, TikTok, Instagram Reels, Facebook HD, Twitter/X y Pinterest).
- 🧠 **Enciclopedia & Conocimiento:** Consultas directas con `.wiki` potenciadas por **Groq Cloud AI** (`Llama 3.3` / `Llama 3.1`), con explicaciones rigurosas y estructuradas.
- 🛡️ **Seguridad y Moderación para Grupos:** 
  - Expulsión inmediata de intrusos con `.antilink`.
  - Filtro antiráfaga con `.antispam` y modo estricto de expulsión con `.antispamkick`.
  - Bienvenida automática con foto de perfil, descripción del grupo y nota de voz PTT oficial `.bienvenido/a`.
- 🎲 **Juegos & Dinámicas Interactivas:** 
  - `.trivia` con banco de preguntas multitemáticas de opción múltiple.
  - `.akinator` (el genio de la lámpara que adivina tu personaje).
  - `.ruleta` rusa con expulsión aleatoria (1 de 6).
  - `.acertijo` con validación de respuestas abiertas y sin acentos.
- ⚡ **Multi-Sesión de Sub-Bots:** Sistema de vinculación mediante código de emparejamiento de 8 dígitos (`.code` / `.subbot`), monitoreo en vivo con `.subbot list` y desconexión segura con `.subbot stop`.
- ⚙️ **Utilidades del Sistema:** Consulta geográfica e información profunda de operadores telefónicos con `.info`, métricas de memoria RSS en tiempo real y tarjeta de contacto vCard oficial del creador.

---

## 📁 Arquitectura del Proyecto

```text
Whatsapp-Bot/
├── index.js                  # Punto de entrada, socket principal y CLI interactivo
├── config.js                 # Configuración central (Dueño, prefijos, límites, rutas)
├── .env.example              # Plantilla pública de variables de entorno
├── .gitignore                # Blindaje estricto de seguridad para repositorios públicos
├── package.json              # Dependencias y scripts de arranque
├── assets/                   # Recursos multimedia oficiales (menú, bienvenida en audio/opus)
├── auth_info/                # Credenciales multi-archivo de Baileys (ignorado en Git)
├── subbots/                  # Sesiones aisladas de Sub-Bots vinculados (ignorado en Git)
├── database/                 # Base de datos JSON local (configuraciones y grupos)
├── data/
│   ├── acertijos.json        # Base de acertijos y respuestas validadas
│   └── trivia.json           # Banco de preguntas para el juego de trivia
├── tmp/                      # Almacén de archivos temporales (limpieza automática)
├── lib/
│   ├── akinator.js           # Motor de sesión para Akinator en Baileys
│   ├── antilink.js           # Administrador de enlaces prohibidos en grupos
│   ├── cleaner.js            # Garbage collector y limpiador de archivos temporales
│   ├── database.js           # Gestor de base de datos atómica en JSON
│   ├── groupPermissions.js   # Verificación normalizada de administradores y LID/JID
│   ├── groupSettings.js      # Caché y persistencia de settings grupales en tiempo real
│   ├── logger.js             # Formateo estilizado en consola y alertas
│   ├── media.js              # Procesamiento de imágenes/video (Sharp, FFmpeg, EXIF WebP)
│   ├── phoneInfo.js          # Extracción de operadoras, región y países (Google libphonenumber)
│   ├── serialize.js          # Normalización y serialización de mensajes de WhatsApp
│   ├── trivia.js             # Motor de trivia interactiva por turnos
│   └── ytdl.js               # Extractor de audio/video con yt-dlp y multiplexado
├── handlers/
│   ├── commandLoader.js      # Carga recursiva de comandos y mapeo de alias
│   ├── groupHandler.js       # Eventos de entrada/salida y bienvenida con audio
│   └── messageHandler.js     # Despachador de mensajes, filtros antispam y comandos
└── commands/
    ├── descargas/            # ytmp3, ytmp4, tiktok, instagram, facebook, twitter, pinterest, gitclone
    ├── group/                # abrir, cerrar, enviarlink, hidetag, linkgroup, notify, revoke, tagall
    ├── groupMod.js           # antilink, antispam, antispamkick, bienvenido/a, promote, demote, kick
    ├── media.js              # toimg, tovideo, tovn, tomp3, tourl
    ├── media/                # sticker, gif, meme, cmeme, blur, qr, readqr, screenshot
    ├── games.js              # akinator, cancelakinator, ruleta, trivia
    ├── tools/                # acertijo, calc, clima, crypto, genimg, ia, info, lyrics, trad
    ├── wiki.js               # wiki (Groq Cloud AI Encyclopedia)
    ├── subbot.js             # code, subbot, subbot list, subbot stop
    └── system/               # menu, comandos, ping, status, owner, prefix, mode, restart, backup, broadcast
```

---

## 🚀 Despliegue Rápido

### 1. Requisitos Previos

- **Node.js:** Versión 18.0.0 o superior (recomendado v20.x LTS o v22.x).
- **FFmpeg:** Instalado en el sistema operativo para transcodificación de video y audio.
- **yt-dlp:** Opcional en el PATH para descargas directas de YouTube de máxima velocidad.

### 2. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/Unsk1ngMD.git
cd Unsk1ngMD
```

### 3. Instalar dependencias
```bash
npm install
```

### 4. Configurar variables de entorno
Copia el archivo de plantilla `.env.example` y renómbralo a `.env`:

```bash
# En Linux / macOS
cp .env.example .env

# En Windows (PowerShell)
Copy-Item .env.example -Destination .env
```

Edita el archivo `.env` con tus credenciales:
```env
# Clave API oficial de Groq Cloud (Gratis en: https://console.groq.com/keys)
GROQ_API_KEY="tu_clave_aqui"

# Número telefónico del creador (con código de país, sin símbolos ni espacios)
OWNER_NUMBER="584160666286"

# Prefijo predeterminado para comandos
DEFAULT_PREFIX="."

# Modo de operación ('public' para todos, 'private' solo para el dueño)
BOT_MODE="public"
```

### 5. Iniciar el bot
```bash
npm start
```

Al iniciar por primera vez, la consola te solicitará elegir el método de vinculación:
- **`[1]` Código QR:** Escanéalo directamente desde WhatsApp (*Dispositivos vinculados > Vincular un dispositivo*).
- **`[2]` Pairing Code (Recomendado):** Ingresa tu número de teléfono para recibir un código de 8 dígitos en la terminal e ingresarlo en WhatsApp.

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

Para mantener el bot ejecutándose permanentemente en un servidor VPS o Raspberry Pi:

```bash
# Instalar PM2 de forma global
npm install -g pm2

# Iniciar el bot con auto-reinicio y límite estricto de memoria RAM
pm2 start index.js --name "unsk1ng-md" --max-memory-restart 300M

# Guardar la configuración para inicio automático con el sistema operativo
pm2 save
pm2 startup
```

Para ver la consola en tiempo real:
```bash
pm2 logs unsk1ng-md
```

---

## 🔒 Privacidad y Buenas Prácticas de Seguridad

- **`.env` Ignorado:** Las claves privadas de API (`GROQ_API_KEY`), credenciales de autenticación y tokens nunca son rastreados por Git.
- **Sesiones Aisladas:** Las carpetas `auth_info/` y `subbots/` están blindadas mediante [`.gitignore`](file:///c:/Users/unkno/OneDrive/Desktop/Whatsapp-Bot/.gitignore).
- **Limpieza de Caché:** El motor interno en [lib/cleaner.js](file:///c:/Users/unkno/OneDrive/Desktop/Whatsapp-Bot/lib/cleaner.js) elimina automáticamente los buffers y archivos multimedia de `tmp/` para prevenir fugas de memoria o saturación de disco.

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Desarrollado con dedicación por **Castrodev**.  
Libre para uso personal y comunitario citando los créditos correspondientes.
