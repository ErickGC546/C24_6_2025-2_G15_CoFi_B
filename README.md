# CoFi — Administración Financiera Colaborativa (Backend)

Breve: CoFi es la solución backend para una aplicación móvil y web dirigida a estudiantes del Instituto de Educación Superior Tecnológico TECSUP. La solución facilita la administración financiera colaborativa (ingresos, egresos, presupuestos compartidos), incorpora alertas, comandos de voz, reportes en tiempo real y recomendaciones personalizadas por IA. El frontend está desarrollado en Dart (aplicación móvil/web) y este repositorio contiene la API y servicios backend implementados en TypeScript.

## Tabla de contenidos
- Descripción
- Características principales
- Arquitectura y stack tecnológico
- Requisitos
- Instalación y ejecución (desarrollo)
- Variables de entorno
- Endpoints principales (ejemplos)
- Pruebas
- Buenas prácticas y seguridad
- Contribuir
- Licencia y contacto

## Descripción
El proyecto responde a las dificultades que enfrentan los estudiantes al gestionar finanzas personales y compartidas (movilidad, alimentación, materiales, gastos de proyectos grupales). CoFi permite:
- Registrar ingresos y egresos (individuales y compartidos).
- Crear y administrar presupuestos compartidos entre miembros de grupos.
- Enviar alertas cuando se acercan límites presupuestarios.
- Generar reportes financieros en tiempo real.
- Ofrecer recomendaciones personalizadas mediante modelos de IA (sugerencias de ahorro, categorización automática de gastos).
- Integración con comandos de voz para registrar operaciones rápidamente.

Objetivo: mejorar el control económico, fomentar planificación financiera y hábitos responsables entre estudiantes.

## Características principales
- Autenticación y autorización de usuarios
- Gestión de cuentas y grupos colaborativos
- Registro y categorización automática de transacciones
- Presupuestos compartidos y notificaciones
- Reportes y paneles de estado (endpoints para consumo por frontend)
- Módulo para recomendaciones (IA) y generación de alertas
- API RESTful documentada

## Arquitectura y stack tecnológico
- Lenguaje: TypeScript (99% del repo)
- Entorno de ejecución: Node.js
- Frameworks comunes (ejemplos típicos): Express / NestJS (dependiendo de la implementación en el repo)
- Base de datos: (por definir en el repo — p. ej. PostgreSQL / MongoDB)
- Autenticación: JWT / OAuth (según implementación)
- Testing: Jest / Supertest (si aplica)
- CI/CD: GitHub Actions (recomendado)
- Frontend: Flutter/Dart (repositorio separado; consume esta API)

## Requisitos
- Node.js >= 16 (o la versión indicada en el repo)
- npm o yarn
- Base de datos (ej. PostgreSQL) configurada según variables de entorno
- (Opcional) Docker y docker-compose para levantar servicios rápidamente

## Instalación y ejecución (desarrollo)
1. Clona el repositorio:
   git clone https://github.com/ErickGC546/C24_6_2025-2_G15_CoFi_B.git
2. Entra en la carpeta:
   cd C24_6_2025-2_G15_CoFi_B
3. Instala dependencias:
   npm install
   o
   yarn install
4. Configura las variables de entorno (ver sección "Variables de entorno").
5. Levanta la base de datos (local o con docker-compose).
6. Ejecuta la aplicación en modo desarrollo:
   npm run dev
   o
   yarn dev
7. Abre el frontend (Flutter/Dart) y configúralo para apuntar al URL de la API (p. ej. http://localhost:3000).

## Pruebas
- Ejecutar tests unitarios:
  npm run test
  o
  yarn test
- Ejecutar tests e2e (si existen):
  npm run test:e2e
  o
  yarn test:e2e
## Contribuir
1. Fork y crea una branch con el nombre feature/descripcion-corta.
2. Abre un Pull Request describiendo los cambios.
3. Ejecuta pruebas y asegúrate de que la aplicación se ejecuta localmente.
4. Sigue las convenciones del proyecto (lint, formateo, tests).

Si quieres, puedo crear plantillas de Issue/PR, o ayudar a configurar GitHub Actions y linters (ESLint/Prettier).

## Equipo y contacto
- Autor / Mantenimiento: ErickGC546 (propietario del repo)
- Frontend (Dart/Flutter): equipo de frontend (repositorio separado)

Para dudas o colaboración, abre un issue en este repositorio o contáctame en GitHub: https://github.com/ErickGC546
