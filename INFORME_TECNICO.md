# Informe Técnico de Arquitectura e Implementación - SQL Copilot Admin v2.3.2 💎

Este documento detalla la arquitectura interna, decisiones de diseño y el funcionamiento técnico de las piezas clave desarrolladas para **SQL Copilot Admin**. El objetivo es proporcionar una referencia técnica clara sobre cómo operan los sistemas más avanzados de la plataforma.

---

## 1. Arquitectura General (Full-Stack Desktop)

El sistema opera bajo un modelo de arquitectura híbrida (Hybrid Stack):

- **Core Moderno**: Frontend en **React 19** con **Vite** para una reactividad instantánea.
- **Backend Robusto**: **Node.js (Express 5)** actuando como un middleware inteligente entre el cliente y los motores de base de datos.
- **Puente Desktop**: **Electron 40** empaqueta la solución. Se implementó una lógica de **Puertos Dinámicos** (`main.js`) que busca automáticamente un puerto libre (empezando en 5005) para evitar conflictos con otros servicios del sistema.
- **Aislamiento de Drivers**: Los drivers de base de datos (`node-firebird`, `pg`, `mysql2`, etc.) se cargan bajo demanda (**Lazy Loading**), reduciendo el consumo de memoria inicial.

---

## 2. Motor de IA: SQL Copilot (NL-to-SQL)

El sistema de IA no es solo un chat; es un motor de traducción técnica.

### ¿Cómo funciona? (`backend/services/aiService.js`)
1. **Extracción de Contexto**: Cada vez que abres el Copilot, el sistema extrae automáticamente el "Esquema Vivo" de la base de datos (tablas, campos y tipos).
2. **System Prompting**: Enviamos a la IA (OpenAI GPT-4o o Gemini 1.5 Pro) una instrucción estricta de "Solo SQL", junto con los metadatos de tu base de datos actual.
3. **Traducción por Dialecto**: La IA recibe el tipo de motor conectado (ej: Firebird) para asegurar que use funciones específicas (como `FIRST/SKIP` en lugar de `LIMIT`).

---

## 3. Smart Optimizer (DBA Virtual)

Esta funcionalidad permite que un usuario sin conocimientos profundos de optimización pueda tunear su base de datos.

- **Lógica de Análisis**: Ejecuta comandos `EXPLAIN` (o `PLAN` en Firebird) sobre la consulta.
- **Interpretación**: El backend captura el archivo JSON o texto del plan de ejecución y lo envía a la IA con una "instrucción de diagnóstico".
- **Salida**: La IA identifica escaneos secuenciales (`Sequential Scans`) o falta de índices y genera una recomendación humana y el código SQL para el nuevo índice.

---

## 4. Visual Explorer: Diagramas ER Dinámicos

Utilizamos **@xyflow/react** para renderizar la base de datos visualmente.

- **Detección de Relaciones**: El motor (`db.js`) consulta las tablas de sistema (`RDB$RELATION_CONSTRAINTS` en Firebird, `information_schema` en otros) para encontrar Foreign Keys.
- **Renderizado Adaptativo**: Cada tabla es un "Nodo Personalizado". Si la tabla tiene muchas columnas, el visor implementa un sistema de scroll interno para no saturar el diagrama.
- **Ubicación Automática**: Los nodos se posicionan inicialmente de forma dinámica, permitiendo al usuario moverlos y visualizar el flujo de datos.

---

## 5. Pipeline de Importación Excel (High Performance)

El importador fue diseñado para manejar miles de filas sin bloquear la interfaz.

1. **Etapa de Staging**: Los datos del Excel se cargan primero en una "Tabla de Trabajo" o memoria temporal para validación.
2. **Bulk-Upsert Inteligente**: A diferencia de un INSERT normal, el sistema detecta la Clave Primaria (PK). Si el registro ya existe, ejecuta un **UPDATE**; si no, un **INSERT**. Esto evita errores de "Llave duplicada".
3. **Sincronización de Generadores**: Después de importar a Firebird, el sistema ejecuta automáticamente un `SET GENERATOR` para igualar el valor máximo importado, evitando errores en futuras inserciones manuales.

---

## 6. Seguridad y Estabilidad en Desktop

- **Seguridad ASAR**: El código está protegido dentro del paquete Electron, pero las bases de datos y configuraciones se escriben en `AppData` (o `Application Support` en Mac) para persistir entre actualizaciones.
- **Drivers Nativos**: Se implementó una reconstrucción (`rebuild`) de módulos nativos como `sqlite3` para que sean compatibles con la arquitectura real de la máquina (Intel vs M1/M2/M3).
- **Control de Sesiones**: Aunque es una app de escritorio, mantiene un sistema de `AuthContext` para proteger el acceso inicial y las llaves de API de IA.

---

## 7. Herramientas Masivas (Power User)

- **Fetch All**: Modifica dinámicamente el `LIMIT` de las consultas a un valor de seguridad muy alto (1,000,000) permitiendo auditorías completas.
- **Find & Replace**: Utiliza la función nativa `REPLACE(CAST(col AS VARCHAR), 'buscar', 'reemplazar')`. El `CAST` es fundamental para que funcione en columnas de tipo BLOB o texto largo sin errores de tipo.

---

**Desarrollado por BinariaOS - 2026**
*Unificando la potencia del SQL con la inteligencia de la IA.*
