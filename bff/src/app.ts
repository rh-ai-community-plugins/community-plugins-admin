import express from 'express';
import catalogRouter from './routes/catalog';
import lifecycleRouter from './routes/lifecycle';
import dashboardRouter from './routes/dashboard';

const app = express();

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/config', (_req, res) => res.json({
  dashboardNamespace: process.env.DASHBOARD_NAMESPACE || 'redhat-ods-applications',
  dashboardDeployment: process.env.DASHBOARD_DEPLOYMENT || 'rhods-dashboard',
}));
app.use('/api/catalog', catalogRouter);
app.use('/api/plugins', lifecycleRouter);
app.use('/api/dashboard', dashboardRouter);

export default app;
