import express from 'express';
import catalogRouter from './routes/catalog';
import lifecycleRouter from './routes/lifecycle';

const app = express();

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/catalog', catalogRouter);
app.use('/api/plugins', lifecycleRouter);

export default app;
