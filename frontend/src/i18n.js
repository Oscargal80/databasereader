import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation dictionaries
const resources = {
    en: {
        translation: {
            "menu": {
                "dbExplorer": "Database Explorer",
                "sqlConsole": "SQL Console",
                "savedQueries": "Saved Queries",
                "excelImport": "Excel Import",
                "userRoles": "Users & Roles",
                "visuals": "Visual Explorer",
                "logOut": "Log Out"
            },
            "login": {
                "title": "SQL Copilot",
                "subtitle": "Enterprise Database Management Platform v1.1",
                "feature1": "Lightning Fast",
                "feature1Desc": "Optimized connection pooling and query execution.",
                "feature2": "Secure Core",
                "feature2Desc": "Encrypted sessions and role-based access control.",
                "formTitle": "Connection Setup",
                "formSubtitle": "Enter your database credentials to begin session.",
                "dbEngine": "Database Engine",
                "host": "Host Server or IP",
                "hostPlaceholder": "e.g. localhost, 192.168.1.10",
                "port": "Port",
                "dbPath": "Database Path / Name",
                "dbPathPlaceholder": "e.g. /data/db.fdb",
                "user": "User",
                "password": "Password",
                "btnTestHost": "Ping Host",
                "btnTestDb": "Test Connection",
                "btnConnect": "Connect Database",
                "designedBy": "Designed by"
            },
            "crud": {
                "actions": "Actions",
                "addRecord": "Add Record",
                "exportExcel": "Export Excel",
                "refresh": "Refresh",
                "tabData": "Data",
                "tabStructure": "Structure",
                "tabIndexes": "Indexes",
                "tabFk": "Foreign Keys",
                "tabDep": "Dependencies",
                "tabSql": "SQL DDL",
                "tabSource": "Source Code",
                "copyInsert": "Copy as INSERT",
                "copyUpdate": "Copy as UPDATE",
                "copyTsv": "Copy with Headers"
            },
            "explorer": {
                "tables": "Tables",
                "systemTables": "System Tables",
                "views": "Views",
                "matViews": "Materialized Views",
                "procedures": "Procedures",
                "triggers": "Triggers",
                "generators": "Generators",
                "reports": "Reports",
                "noData": "No data or error loading",
                "empty": "Empty",
                "rows": "rows"
            },
            "sql": {
                "title": "SQL Console",
                "placeholder": "Write your SQL query here...",
                "run": "Run Query",
                "clear": "Clear",
                "export": "Export Excel",
                "aiTitle": "AI SQL Assistant",
                "aiPlaceholder": "Describe what you want to consult (e.g. 'Show me the last 5 customers')...",
                "aiBtn": "Generate SQL",
                "saveBtn": "Save to Library",
                "results": "Results",
                "empty": "No results yet. Run a query to see data.",
                "saveTitle": "Save Query",
                "saveName": "Query Name",
                "saveDesc": "Description",
                "saveConfirm": "Save Query",
                "saveSuccess": "Query saved successfully",
                "execSuccess": "Command executed successfully.",
                "noRows": "Query successful, but no rows returned.",
                "generating": "Generating...",
                "processedBy": "Processed by:"
            },
            "importer": {
                "title": "Excel Importer",
                "selectTab": "Select Target Table",
                "upload": "Upload .xlsx File",
                "execute": "Execute Import",
                "mappingTitle": "Field Mapping",
                "mappingDesc": "Map Excel columns to table fields.",
                "preview": "Preview (First 5 Rows)",
                "rowsLoaded": "{{count}} rows loaded from Excel.",
                "importing": "Importing records...",
                "success": "Import finished. Success: {{success}}, Failed: {{failed}}"
            },
            "library": {
                "title": "Queries Library",
                "search": "Search in library...",
                "deleteConfirm": "Are you sure you want to delete this query?",
                "deleteSuccess": "Query deleted successfully",
                "executeBtn": "Execute",
                "newQuery": "New Query",
                "noQueries": "No saved queries found",
                "noQueriesDesc": "Save your frequent queries from the SQL Console to see them here."
            },
            "users": {
                "title": "Users & Roles",
                "refresh": "Refresh",
                "createBtn": "Create User",
                "colUsername": "Username",
                "colFirstName": "First Name",
                "colLastName": "Last Name",
                "actions": "Actions",
                "dialogTitle": "Create New Firebird User",
                "fieldUsername": "Username",
                "fieldPassword": "Password",
                "confirmBtn": "Create",
                "cancelBtn": "Cancel",
                "deleteConfirm": "Are you sure you want to delete user {{username}}?",
                "fetchError": "Error fetching users",
                "createError": "Create user failed",
                "deleteError": "Delete user failed"
            }
        }
    },
    es: {
        translation: {
            "menu": {
                "dbExplorer": "Explorador de Base de Datos",
                "sqlConsole": "Consola SQL",
                "savedQueries": "Consultas Guardadas",
                "excelImport": "Importar Excel",
                "userRoles": "Usuarios y Roles",
                "visuals": "Explorador Visual",
                "logOut": "Cerrar Sesión"
            },
            "login": {
                "title": "SQL Copilot",
                "subtitle": "Plataforma Empresarial de Gestión de BD v1.1",
                "feature1": "Ultra Rápido",
                "feature1Desc": "Pool de conexiones y ejecución de consultas optimizada.",
                "feature2": "Núcleo Seguro",
                "feature2Desc": "Sesiones encriptadas y control de acceso por roles.",
                "formTitle": "Configuración de Conexión",
                "formSubtitle": "Ingresa las credenciales de tu base de datos.",
                "dbEngine": "Motor de Base de Datos",
                "host": "Servidor u Horigen (IP)",
                "hostPlaceholder": "ej. localhost, 192.168.1.10",
                "port": "Puerto",
                "dbPath": "Ruta / Nombre de BD",
                "dbPathPlaceholder": "ej. /datos/bd.fdb",
                "user": "Usuario",
                "password": "Contraseña",
                "btnTestHost": "Hacer Ping",
                "btnTestDb": "Probar Conexión",
                "btnConnect": "Conectar Base de Datos",
                "designedBy": "Diseñado por"
            },
            "crud": {
                "actions": "Acciones",
                "addRecord": "Añadir Registro",
                "exportExcel": "Exportar a Excel",
                "refresh": "Actualizar",
                "tabData": "Datos",
                "tabStructure": "Estructura",
                "tabIndexes": "Índices",
                "tabFk": "Llaves Foráneas",
                "tabDep": "Dependencias",
                "tabSql": "DDL SQL",
                "tabSource": "Código Fuente",
                "copyInsert": "Copiar como INSERT",
                "copyUpdate": "Copiar como UPDATE",
                "copyTsv": "Copiar con Cabeceras"
            },
            "explorer": {
                "tables": "Tablas",
                "systemTables": "Tablas de Sistema",
                "views": "Vistas",
                "matViews": "Vistas Materializadas",
                "procedures": "Procedimientos",
                "triggers": "Triggers",
                "generators": "Generadores",
                "reports": "Reportes",
                "noData": "Sin datos o error de carga",
                "empty": "Vacío",
                "rows": "filas"
            },
            "sql": {
                "title": "Consola SQL",
                "placeholder": "Escribe tu consulta SQL aquí...",
                "run": "Ejecutar",
                "clear": "Limpiar",
                "export": "Exportar Excel",
                "aiTitle": "Asistente SQL IA",
                "aiPlaceholder": "Describe lo que quieres consultar (ej. 'Muéstrame los últimos 5 clientes')...",
                "aiBtn": "Generar SQL",
                "saveBtn": "Guardar en Biblioteca",
                "results": "Resultados",
                "empty": "Sin resultados aún. Ejecuta una consulta para ver datos.",
                "saveTitle": "Guardar Consulta",
                "saveName": "Nombre de la Consulta",
                "saveDesc": "Descripción",
                "saveConfirm": "Guardar",
                "saveSuccess": "Consulta guardada exitosamente",
                "execSuccess": "Comando ejecutado exitosamente.",
                "noRows": "Consulta exitosa, pero no se devolvieron filas.",
                "generating": "Generando...",
                "processedBy": "Procesado por:"
            },
            "importer": {
                "title": "Importador Excel",
                "selectTab": "Seleccionar Tabla Destino",
                "upload": "Subir Archivo .xlsx",
                "execute": "Ejecutar Importación",
                "mappingTitle": "Mapeo de Campos",
                "mappingDesc": "Mapea las columnas de Excel a los campos de la tabla.",
                "preview": "Vista Previa (5 filas)",
                "rowsLoaded": "{{count}} filas cargadas desde Excel.",
                "importing": "Importando registros...",
                "success": "Importación finalizada. Éxito: {{success}}, Fallas: {{failed}}"
            },
            "library": {
                "title": "Biblioteca de Consultas",
                "search": "Buscar en biblioteca...",
                "deleteConfirm": "¿Estás seguro de eliminar esta consulta?",
                "deleteSuccess": "Consulta eliminada exitosamente",
                "executeBtn": "Ejecutar",
                "newQuery": "Nueva Consulta",
                "noQueries": "No se encontraron consultas guardadas",
                "noQueriesDesc": "Guarda tus consultas frecuentes desde la Consola SQL para verlas aquí."
            },
            "users": {
                "title": "Usuarios y Roles",
                "refresh": "Actualizar",
                "createBtn": "Crear Usuario",
                "colUsername": "Usuario",
                "colFirstName": "Nombre",
                "colLastName": "Apellido",
                "actions": "Acciones",
                "dialogTitle": "Crear Nuevo Usuario Firebird",
                "fieldUsername": "Usuario",
                "fieldPassword": "Contraseña",
                "confirmBtn": "Crear",
                "cancelBtn": "Cancelar",
                "deleteConfirm": "¿Estás seguro de eliminar al usuario {{username}}?",
                "fetchError": "Error al obtener usuarios",
                "createError": "Falla al crear usuario",
                "deleteError": "Falla al eliminar usuario"
            }
        }
    },
    pt: {
        translation: {
            "menu": {
                "dbExplorer": "Explorador de Banco de Dados",
                "sqlConsole": "Console SQL",
                "savedQueries": "Consultas Salvas",
                "excelImport": "Importar Excel",
                "userRoles": "Usuários e Funções",
                "visuals": "Explorador Visual",
                "logOut": "Sair"
            },
            "login": {
                "title": "SQL Copilot",
                "subtitle": "Plataforma Corporativa de Gestão de BD v1.1",
                "feature1": "Ultra Rápido",
                "feature1Desc": "Pool de conexões e execução de consultas otimizada.",
                "feature2": "Núcleo Seguro",
                "feature2Desc": "Sessões criptografadas e controle de acesso.",
                "formTitle": "Configuração de Conexão",
                "formSubtitle": "Insira as credenciais do seu banco de dados.",
                "dbEngine": "Motor de Banco de Dados",
                "host": "Servidor Hospedeiro ou IP",
                "hostPlaceholder": "ex. localhost, 192.168.1.10",
                "port": "Porta",
                "dbPath": "Caminho / Nome do BD",
                "dbPathPlaceholder": "ex. /dados/bd.fdb",
                "user": "Usuário",
                "password": "Senha",
                "btnTestHost": "Fazer Ping",
                "btnTestDb": "Testar Conexão",
                "btnConnect": "Conectar Banco",
                "designedBy": "Desenvolvido por"
            },
            "crud": {
                "actions": "Ações",
                "addRecord": "Adicionar Registro",
                "exportExcel": "Exportar Excel",
                "refresh": "Atualizar",
                "tabData": "Dados",
                "tabStructure": "Estrutura",
                "tabIndexes": "Índices",
                "tabFk": "Chaves Estrangeiras",
                "tabDep": "Dependências",
                "tabSql": "SQL DDL",
                "tabSource": "Código Fonte",
                "copyInsert": "Copiar como INSERT",
                "copyUpdate": "Copiar como UPDATE",
                "copyTsv": "Copiar com Cabeçalhos"
            },
            "explorer": {
                "tables": "Tabelas",
                "systemTables": "Tabelas de Sistema",
                "views": "Views",
                "matViews": "Views Materializadas",
                "procedures": "Procedimentos",
                "triggers": "Gatilhos",
                "generators": "Geradores",
                "reports": "Relatórios",
                "noData": "Sem dados ou erro de carregamento",
                "empty": "Vazio",
                "rows": "linhas"
            },
            "sql": {
                "title": "Console SQL",
                "placeholder": "Escreva sua consulta SQL aqui...",
                "run": "Executar",
                "clear": "Limpar",
                "export": "Exportar Excel",
                "aiTitle": "Assistente SQL IA",
                "aiPlaceholder": "Descreva o que você deseja consultar (ex: 'Mostre-me os últimos 5 clientes')...",
                "aiBtn": "Gerar SQL",
                "saveBtn": "Salvar na Biblioteca",
                "results": "Resultados",
                "empty": "Nenhum resultado ainda. Execute uma consulta para ver os dados.",
                "saveTitle": "Salvar Consulta",
                "saveName": "Nome da Consulta",
                "saveDesc": "Descrição",
                "saveConfirm": "Salvar",
                "saveSuccess": "Consulta salva com sucesso",
                "execSuccess": "Comando executado com sucesso.",
                "noRows": "Consulta bem-sucedida, mas nenhuma linha retornada.",
                "generating": "Gerando...",
                "processedBy": "Processado por:"
            },
            "importer": {
                "title": "Importador Excel",
                "selectTab": "Selecionar Tabela de Destino",
                "upload": "Enviar Arquivo .xlsx",
                "execute": "Executar Importação",
                "mappingTitle": "Mapeamento de Campos",
                "mappingDesc": "Mapear colunas do Excel para campos da tabela.",
                "preview": "Prévia (5 linhas)",
                "rowsLoaded": "{{count}} linhas carregadas do Excel.",
                "importing": "Importando registros...",
                "success": "Importação finalizada. Sucesso: {{success}}, Falhas: {{failed}}"
            },
            "library": {
                "title": "Biblioteca de Consultas",
                "search": "Pesquisar na biblioteca...",
                "deleteConfirm": "Tem certeza de que deseja excluir esta consulta?",
                "deleteSuccess": "Consulta excluída com sucesso",
                "executeBtn": "Executar",
                "newQuery": "Nova Consulta",
                "noQueries": "Nenhuma consulta salva encontrada",
                "noQueriesDesc": "Salve suas consultas frequentes do Console SQL para vê-las aqui."
            },
            "users": {
                "title": "Usuários e Funções",
                "refresh": "Atualizar",
                "createBtn": "Criar Usuário",
                "colUsername": "Usuário",
                "colFirstName": "Nome",
                "colLastName": "Sobrenome",
                "actions": "Ações",
                "dialogTitle": "Criar Novo Usuário Firebird",
                "fieldUsername": "Usuário",
                "fieldPassword": "Senha",
                "confirmBtn": "Criar",
                "cancelBtn": "Cancelar",
                "deleteConfirm": "Tem certeza de que deseja excluir o usuário {{username}}?",
                "fetchError": "Erro ao buscar usuários",
                "createError": "Falha ao criar usuário",
                "deleteError": "Falha ao excluir usuário"
            }
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;
