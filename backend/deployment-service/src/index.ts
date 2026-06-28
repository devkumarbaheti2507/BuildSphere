import express from 'express';

const serviceName = process.env.SERVICE_NAME ?? 'deployment-service';
const port = Number(process.env.PORT ?? 8084);

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
    description: 'Manages deployment targets and generated deployment assets.',
    docs: 'Read AGENTS.md and the matching spec before implementation.',
  });
});

app.listen(port, () => {
  console.log(serviceName + ' listening on port ' + port);
});
