# Junta de Saneamiento JSYBYPE — Sistema de Gestión, Caja y Cobros

Aplicación web y PWA desarrollada para la administración de socios, facturación de cuotas, cobros, anticipos, donaciones, gastos, proveedores y cierre mensual de la Junta de Saneamiento JSYBYPE.

## Módulos y funciones principales
- **Caja y Cobros (`admin-junta.html`, `admin-cobros.js`):** registro de pagos de facturas, amortizaciones parciales, generación de anticipos/saldo a favor, bloqueo de cuentas inactivas y anulación lógica con motivo y resguardo si un anticipo ya fue consumido.
- **Socios y Padrón (`padron.html`, `admin-socios.js`):** alta rápida y gestión del padrón de socios, número de cuenta automático, estado activo/inactivo, saldos pendientes y saldos a favor.
- **Gastos y Proveedores (`proveedores.html`, `admin-proveedores.js`, `admin-gastos.js`):** padrón de proveedores con RUC y vigencia de timbrado, registro de gastos con formato de factura de 13 dígitos (`XXX-XXX-XXXXXXX`), validación fiscal contra duplicados y anulación con motivo.
- **Donaciones (`admin-donaciones.js`):** registro de donaciones de socios, municipalidad, gobernación u otros aportes, con filtro de activas/anuladas.
- **Cuotas, Reportes y Cierre Mensual (`admin-cuotas-reportes.js`, `cierre.html`):** generación masiva de cuotas mensuales evitando duplicados, reportes imprimibles en PDF y cálculo de cierre mensual con saldo propio de la Junta.
- **Portal del Socio (`index.html`, `portal-cliente.html`, `main.js`):** consulta de estado de cuenta y comprobantes para socios.

## Tecnologías
- HTML5, CSS3 y Tailwind CSS
- JavaScript (ES6+)
- Supabase (`@supabase/supabase-js`) para autenticación, base de datos y funciones RPC
- PWA (`manifest.json` y `sw.js`) con zona horaria `America/Asuncion`

## Cómo correr
1. Servir los archivos del proyecto con un servidor local (por ejemplo VS Code Live Server, `npx serve` o similar) o desde su despliegue web.
2. Ingresar con una cuenta de administrador habilitada para operar en los módulos de gestión y cierre mensual.

Hecho con dedicación desde Paraguay.