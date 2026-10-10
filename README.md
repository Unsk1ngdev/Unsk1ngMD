# 🤖 Unsk1ngMD - WhatsApp Bot Modular & Autoalojable

Un bot de WhatsApp de alto rendimiento, modular, robusto y autoalojable construido con **Node.js** y **[@whiskeysockets/baileys](https://github.com/whiskeysockets/baileys)**.

- **Nombre oficial:** Unsk1ngMD
- **Creador / Owner:** Castrodev (+584160666286)
- **Metadatos de Stickers (EXIF):** Pack: `Unsk1ngMD` | Autor: `Dev`
- **Consumo de recursos:** Optimizado para bajo consumo de memoria RAM (**< 250MB**).

---

## 🚀 Características Principales

- **Conexión Moderna:** Desarrollado sobre `@whiskeysockets/baileys` con almacenamiento multi-archivo (`useMultiFileAuthState`).
- **Autenticación Dual Interactiva:** Permite elegir en la terminal al arrancar entre:
  - `[1]` Vincular mediante **Código QR**.
  - `[2]` Vincular mediante **Código de emparejamiento de 8 dígitos (Pairing Code)** solicitando el número telefónico.
- **Reconexión Automática:** Reintentos continuos ante desconexiones de red, salvo cierre voluntario de sesión (`DisconnectReason.loggedOut`).
- **Base de Datos Ligera y Nativa:** Sin dependencias de bases pesadas (cero MongoDB / PostgreSQL). Usa JSON atómico con persistencia local para prefijos, modos y filtros.
- **Juego de Acertijos en Vivo:** Módulo interactivo con temporizador de 60 segundos por chat, detección de respuestas en tiempo real y revelación automática.
- **Multimedia Avanzada & GIF Stickers:** Conversión de imágenes y videos cortos/GIFs a WebP optimizado con metadatos EXIF oficiales de WhatsApp.
- **Optimización de Memoria RAM:**
  - Historial de chat masivo desactivado (`syncFullHistory: false`).
  - Limpieza periódica automática de buffers y archivos temporales en `./tmp/`.
  - Logs de depuración silenciados internamente.

---

## 📁 Arquitectura del Proyecto

```text
Whatsapp-Bot/
├── index.js                  # Punto de entrada, inicio de socket y auth interactiva
├── config.js                 # Parámetros globales (Unsk1ngMD, Castrodev, etc.)
├── .env.example              # Plantilla de variables de entorno
├── package.json              # Dependencias y scripts de ejecución
├── assets/                   # Archivos multimedia del bot (menu.jpg, menu.gif)
├── auth_info/                # Credenciales de sesión de Baileys (ignorado en git)
├── database/                 # Almacenamiento JSON ligero (settings.json, groups.json)
├── tmp/                      # Archivos temporales de procesamiento (limpieza periódica)
├── lib/
│   ├── acertijo.js           # Motor del juego de acertijos, temporizadores y respuestas
│   ├── cleaner.js            # Limpieza periódica de archivos temporales y GC
│   ├── database.js           # Gestor de base de datos JSON local
│   ├── logger.js             # Formato estético y logs en consola
│   ├── media.js              # Procesamiento multimedia (Sharp, FFmpeg, EXIF, QR)
│   └── serialize.js          # Normalización y serialización de mensajes de WhatsApp
├── handlers/
│   ├── commandLoader.js      # Cargador dinámico recursivo de comandos
│   ├── groupHandler.js       # Manejador de eventos de grupos (bienvenida/salida)
│   └── messageHandler.js     # Filtro antilink, respuestas de acertijos y despachador
└── commands/
    ├── multimedia/           # .sticker, .s, .gif, .toimg, .tomp3, .tovn, .meme, .cmeme, .blur, .qr, .readqr, .screenshot
    ├── grupo/                # .tagall, .hidetag, .notify, .enviarlink, .abrir, .cerrar, .kick, .promote, .demote, .linkgroup, .revoke, .antienlaces
    ├── herramientas/         # .acertijo, .ia, .genimg, .trad, .clima, .wiki, .calc, .crypto, .lyrics
    ├── descargas/            # .ytmp3, .ytmp4, .tiktok, .pinterest, .gitclone
    └── sistema/              # .owner, .menu, .ping, .status, .prefix, .mode, .broadcast, .backup, .restart
```

---

## ⚙️ Requisitos Previos

1. **Node.js:** Versión 18.0.0 o superior (recomendado v20.x LTS o superior).
2. **FFmpeg:** 
   - El proyecto incluye `@ffmpeg-installer/ffmpeg` precompilado de forma automática para Windows, Linux y macOS.
   - En Linux VPS (Ubuntu/Debian), también puedes instalarlo opcionalmente con:
     ```bash
     sudo apt update && sudo apt install -y ffmpeg
     ```

---

## 🛠️ Instalación y Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/whatsapp-bot.git
cd whatsapp-bot
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Copia el archivo de plantilla `.env.example` a `.env`:
```bash
# En Linux / Mac
cp .env.example .env

# En Windows (PowerShell)
copy .env.example .env
```

El archivo `.env` ya viene preconfigurado para Unsk1ngMD:
```env
BOT_NAME="Unsk1ngMD"
DEFAULT_PREFIX="."
OWNER_NUMBER="584160666286"
OWNER_NAME="Castrodev"
PACK_NAME="Unsk1ngMD"
AUTHOR_NAME="Dev"
BOT_MODE="public"
```

### 4. Iniciar el bot
```bash
npm start
```

Al arrancar por primera vez sin sesión previa:
- Selecciona `1` para escanear el **Código QR** desde WhatsApp (Dispositivos vinculados > Vincular un dispositivo).
- O selecciona `2` para vincular mediante **Código de emparejamiento de 8 dígitos**, ingresando tu número con código de país (ej. `584160666286`).

---

## 📖 Catálogo de Comandos Destacados

### 👑 Sistema & Creador
- **`.owner`**: Envía la tarjeta de contacto oficial (vCard) e información de contacto directo de Castrodev (+584160666286).
- **`.menu` / `.help`**: Despliega el menú categorizado. Admite reproducción de video/GIF interactivo (`assets/menu.gif` / `assets/menu.mp4`) o imagen de portada (`assets/menu.jpg`).
- **`.ping`**: Consulta la latencia de respuesta en milisegundos.
- **`.status`**: Muestra métricas de memoria RAM (RSS, Heap), CPU, uptime y comandos procesados.

### 🎨 Multimedia & Stickers
- **`.s` / `.sticker`**: Convierte una imagen estática a Sticker WebP con metadatos *"Unsk1ngMD | Dev"*.
- **`.gif`**: Convierte un video corto (máx. 10s) o GIF en un sticker animado optimizado y ligero.
- **`.meme`**: Obtiene un meme real de Reddit / repositorios abiertos con su título.
- **`.cmeme [arriba | abajo]`**: Crea un meme personalizado sobre la imagen citada con tipografía Impact y ajuste dinámico.
- **`.toimg`**: Convierte sticker estático a imagen PNG/JPG.
- **`.tomp3`**: Extrae audio en formato MP3 desde un video citado.
- **`.tovn`**: Convierte audio o video a nota de voz PTT oficial de WhatsApp.
- **`.qr [texto]`**: Genera un código QR en imagen.
- **`.readqr`**: Escanea y extrae texto de una imagen QR.
- **`.screenshot [url]`**: Captura de pantalla de una URL pública.

### 👥 Administración de Grupos
- **`.enviarlink [número]`**: Extrae el enlace del grupo actual y lo envía por mensaje privado al número indicado (+18494509905).
- **`.notify [texto]`**: Anuncio de administración que menciona a todos los miembros del grupo.
- **`.tagall [motivo]`**: Menciona visiblemente a todos los integrantes.
- **`.hidetag [texto]`**: Notificación general sin lista visible.
- **`.abrir` / `.cerrar`**: Habilita o restringe el chat solo para administradores.
- **`.kick @usuario`**: Expulsa a un participante.
- **`.promote` / `.demote`**: Gestión de administradores.
- **`.antienlaces [on/off]`**: Protección activa antienlaces.

### 🧩 Juegos & Entretenimiento
- **`.acertijo` / `.acertijos`**: Inicia una ronda de adivinanzas con 60 segundos de temporizador. Los participantes responden directamente en el chat sin prefijo; el bot valida aciertos y revela la solución si se acaba el tiempo.

### 📥 Descargas Estables
- **`.ytmp3 [link]`**: Descarga audio de YouTube en MP3 en alta calidad.
- **`.ytmp4 [link]`**: Descarga video comprimido en MP4 de YouTube.
- **`.tiktok [link]`**: Descarga videos de TikTok en alta definición sin marca de agua.
- **`.pinterest [búsqueda]`**: Busca y envía imágenes temáticas.
- **`.gitclone [url]`**: Descarga el código `.zip` de repositorios públicos de GitHub.

---

## 🛡️ Ejecución en Producción 24/7 (PM2)

```bash
# Iniciar el bot con límite estricto de memoria RAM
pm2 start index.js --name "unsk1ng-md" --max-memory-restart 250M

# Ver logs en vivo
pm2 logs unsk1ng-md
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Desarrollado por Castrodev.
