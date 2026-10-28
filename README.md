# myjira

Cliente mínimo de Jira (estilo Linear): sprint actual, backlog y detalle de issues.

```bash
cp .env.example .env   # rellena JIRA_BASE_URL, JIRA_EMAIL y JIRA_API_TOKEN
npm install
npm run dev            # web en http://localhost:5173, API en :3101
```

- `server/index.js`: proxy Express hacia Jira Cloud. Las credenciales se quedan en el servidor.
- `web/`: React + React Query (Vite).

Producción local: `npm run build && npm start`, que sirve todo desde :3101.
