# ⚡ AceptaElReto to GitHub Sync

<p align="center">
  <img src="icons/icon128.png" alt="AceptaElReto Sync Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>Sincronización desatendida y automática de soluciones en Acepta el Reto hacia GitHub.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Chrome-Extension-success?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/GitHub-REST%20API%20v3-181717?style=flat-square&logo=github" alt="GitHub API" />
  <img src="https://img.shields.io/badge/Lenguajes-C%2B%2B%20%7C%20Java%20%7C%20C-orange?style=flat-square" alt="Lenguajes Soportados" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="License MIT" />
</p>

---

## 📌 ¿Qué es AceptaElReto Sync?

**AceptaElReto to GitHub Sync** es una extensión para Google Chrome construida sobre **Manifest V3** que automatiza por completo el flujo de subida de problemas resueltos en el juez en línea [Acepta el Reto](https://aceptaelreto.com/). 

Inspirada en herramientas como *LeetSync*, detecta tus envíos con veredicto **Accepted (AC)**, extrae las estadísticas oficiales de tiempo y memoria, descarga el enunciado formateado en Markdown y realiza el commit directamente a tu repositorio de soluciones sin que tengas que copiar y pegar nada.

---

## ✨ Características Principales

* 🚀 **Sincronización 100% Automática:** Captura el código durante el envío (`send.php`) y, en cuanto el juez confirma el veredicto **AC** en `submission.php`, sube el archivo a GitHub.
* ☕ **Multi-lenguaje Nativo:** Reconoce y gestiona automáticamente soluciones en **C++** (`.cpp`), **Java** (`.java`) y **C** (`.c`).
* 📊 **Métricas Exactas del Juez:** Extrae el tiempo de ejecución en CPU, memoria consumida, ID de envío y fecha de resolución directamente desde el DOM de la evaluación.
* 📝 **Enunciados Formateados:** Parsea la página oficial del problema (`statement.php`), limpia etiquetas prescindibles y genera un `README.md` estructurado con límites, entradas y salidas de ejemplo.
* 📑 **Tabla-Índice Autogestionada:** Reconstruye y actualiza dinámicamente una tabla central en el `README.md` raíz de tu repositorio con enlaces directos a cada carpeta y código de solución.
* 🍩 **Dashboard Estilo LeetSync:**
  * **Donut SVG animado:** Visualiza el porcentaje de uso de cada lenguaje (C++, Java, C) con barrido de giro de derecha a izquierda.
  * **Racha de envíos:** Indicador de actividad durante los últimos 5 días.
  * **Menú de configuración:** Permite cambiar el repositorio de destino, definir subcarpetas personalizadas o cerrar sesión de forma segura.

---

## 🖥️ Interfaz de la Extensión

| Vista de Autenticación | Dashboard de Métricas |
| :---: | :---: |
| Conexión mediante Personal Access Token (PAT) con permisos de repositorio | Gráfico Donut de lenguajes, histórico de actividad y menú desplegable |

---

## 🚀 Instalación y Puesta en Marcha

Para utilizar la extensión en tu navegador sin necesidad de compilar nada:

Descargala aqui: https://chromewebstore.google.com/detail/llgjjcjmighopnnfmkokkhnlaibdapag?utm_source=item-share-cb
