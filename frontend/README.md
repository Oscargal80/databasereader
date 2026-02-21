# Universal DB Admin - Frontend ⚛️

**Universal DB Admin v2.0 Frontend Stack**
**© Copyright BinariaOS 2026.** All rights reserved.

This is the robust frontend component of the **Universal DB Admin** pipeline, driven by standard bleeding-edge React and configured deeply through Vite. Designed initially to deliver a premium, multi-dialect, dynamically responsive visual terminal to connect directly with Firebird, PostgreSQL, MySQL, SQL Server, and SQLite nodes.

## 🚀 Version 2.0 Key Enhancements

- **Global State Orchestration**: Eradicated traditional heavy prop-drilling structures inside the layout by implementing **Zustand**. User structural paradigms like Drawer status and Night/Light Mode are handled and persisted exclusively inside this blazing-fast data store.
- **Data Analytics Dashboard**: Fused **Recharts** natively into the entry viewport bridging a highly-responsive live telemetry reading of backend Database components.
- **Infinite HTTP Streams Exporter**: Detached conventional heavy DOM-Based Client `.xlsx` exporters and engineered a direct networking `<a>` tunnel to harness the Node.js 5k-paginated Stream CSV generator, negating out-of-memory cascades completely on massive 1-Million+ rows tables.
- **Refactored Architecture**: The previously monolithic components like `CRUD.jsx` and `Login.jsx` have been systematically decoupled into strict atomic and maintainable files.

## 🛠️ Core Tech Stack

- **Logic Layer**: [React 19+](https://reactjs.org/)
- **Bundler & Tooling**: [Vite 7+](https://vitejs.dev/)
- **State Store**: [Zustand 5+](https://zustand-demo.pmnd.rs/)
- **Styling Authority**: [Material UI (MUI)](https://mui.com/)
- **Data Viz**: [Recharts](https://recharts.org/)
- **I18n Engine**: [react-i18next](https://react.i18next.com/)

## 🔧 Operation Guidelines

### Prerequisites
- Active active installation of Node.js (v18 min max recommended v20+).
- Secure reachable linkage to the counterpart Universal DB Admin Backend API router.

### Installation
1. Navigate directly to the client directory:
   ```bash
   cd frontend
   ```
2. Provision node packages:
   ```bash
   npm install
   ```

### Live Development Iteration
Instantiate the Vite Hot Module Replacement (HMR) node on `localhost`:
```bash
npm run dev
```

### Production Bundling Stage
Transpile the hyper-optimized web payload inside `/dist`:
```bash
npm run build
```

## 🌐 Production Extensibilities

### Relative Base Referencing
The main bundle enforces extremely portable routing rules via its `base: './'` injection in `vite.config.js`. This certifies the SPA may be dynamically dropped inside a root domain or a trailing subdirectory node organically without breaking static asset resolution mechanisms.

### Apache Fallback Logic (`.htaccess`)
A transparent `public/.htaccess` rulebook inherently carries over to the `dist` emit directory on build. Configuration rules involve:
1. Native fallback parsing guaranteeing **Single Page Application (SPA)** reload integrity avoiding standard 404 Apache traps.
2. Inferred implicit backend proxying sending `/api` calls safely to inner backend topologies running on standard `localhost:5000` arrays.

### Environment Control Variables
Bind the target backend by invoking `.env.production` (or standard machine environment parameters) before deployment compilation:
- `VITE_API_URL`: Direct link to your live Node.js hub (e.g., `https://api.yourdomain.com/api`).

---
Developed by **BinariaOS**.
