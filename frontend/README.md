# Universal DB Admin - Frontend ⚛️

This is the frontend component of the **Universal DB Admin** project, built with React and Vite. It provides a premium, multilingual, and responsive interface for managing Firebird, PostgreSQL, MySQL, SQL Server, and SQLite databases.

## 🚀 Key Features

- **Modern UI/UX**: Built with Material UI (MUI v6) and optimized with Grid v2 for a professional and seamless experience.
- **Multi-Language Support (i18n)**: Full support for English, Spanish, and Portuguese with automatic language detection and persistence.
- **Dynamic Database Explorer**: Real-time browsing of tables, views, procedures, and metadata.
- **SQL Console with AI**: Advanced editor with history, Excel export, and an integrated AI assistant to generate SQL from natural language.
- **Responsive Management**: Form generation for CRUD operations, handling both read-write and read-only entities.
- **Excel Tools**: Native export functionality for tables and query results, plus a dedicated Excel data importer.

## 🛠️ Tech Stack

- **Core**: [React 18+](https://reactjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Material UI (MUI)](https://mui.com/)
- **I18n**: [react-i18next](https://react.i18next.com/)
- **API Client**: [Axios](https://axios-http.com/)
- **Excel Support**: [SheetJS (XLSX)](https://sheetjs.com/)

## 🔧 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Access to the corresponding Backend API.

### Installation
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
Start the development server with Hot Module Replacement (HMR):
```bash
npm run dev
```

### Production Build
Generate a highly optimized production build in the `dist` folder:
```bash
npm run build
```

## 🌐 Deployment Notes

### Relative Base Path
The build is configured with `base: './'` in `vite.config.js`. This allows you to host the application in any subdirectory or domain root without breaking asset links.

### Apache Hosting (`.htaccess`)
The `public/.htaccess` file is automatically included in the `dist` folder. It is pre-configured to:
1. Handle **Single Page Application (SPA)** routing so page refreshes don't result in 404 errors.
2. Proxy `/api` requests to a backend running on `localhost:5000` (adjustable in the file).

### Environment Variables
Configure your API endpoint in `.env.production` or via system environment variables:
- `VITE_API_URL`: The full URL to your backend API (e.g., `https://api.yourdomain.com/api`).

---
Developed by **BinariaOS**.
