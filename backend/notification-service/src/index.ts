import express from 'express';

const serviceName = process.env.SERVICE_NAME ?? 'notification-service';
const port = Number(process.env.PORT ?? 8089);

const app = express();
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({
    service: serviceName,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_request, response) => {
  response.json({
    service: serviceName,
    description: 'Stores and manages user notifications.',
    docs: 'Read AGENTS.md and the matching spec before implementation.',
  });
});

app.listen(port, () => {
  console.log(serviceName + ' listening on port ' + port);
});
