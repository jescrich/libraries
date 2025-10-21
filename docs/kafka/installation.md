---
sidebar_position: 2
---
# Installation & Setup

## Installation

Install the package using npm:

```bash
npm install @jescrich/nestjs-kafka-client
```

## Basic Module Setup

### Import the Modules

```typescript
import { Module } from '@nestjs/common';
import { KafkaModule, ConsumerModule } from '@jescrich/nestjs-kafka-client';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: 'my-app',
      brokers: ['localhost:9092'],
    }),
    ConsumerModule,
  ],
})
export class AppModule {}
```

### Environment Configuration

For production environments, use environment variables:

```typescript
KafkaModule.forRoot({
  clientId: process.env.KAFKA_CLIENT_ID || 'my-app',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  ssl: process.env.KAFKA_SSL === 'true',
  sasl: process.env.KAFKA_USERNAME ? {
    mechanism: 'plain',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  } : undefined,
})
```

### Advanced Configuration

For enterprise deployments with authentication and SSL:

```typescript
KafkaModule.forRoot({
  clientId: 'my-production-app',
  brokers: ['kafka-1.example.com:9092', 'kafka-2.example.com:9092'],
  
  // SSL Configuration
  ssl: {
    rejectUnauthorized: true,
    ca: [fs.readFileSync('/path/to/ca-cert.pem', 'utf-8')],
    key: fs.readFileSync('/path/to/client-key.pem', 'utf-8'),
    cert: fs.readFileSync('/path/to/client-cert.pem', 'utf-8'),
  },
  
  // SASL Authentication
  sasl: {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
  
  // Connection settings
  connectionTimeout: 3000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
})
```

## Async Configuration

For dynamic configuration loading:

```typescript
KafkaModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    clientId: configService.get('KAFKA_CLIENT_ID'),
    brokers: configService.get('KAFKA_BROKERS').split(','),
    ssl: configService.get('KAFKA_SSL') === 'true',
    sasl: {
      mechanism: 'scram-sha-256',
      username: configService.get('KAFKA_USERNAME'),
      password: configService.get('KAFKA_PASSWORD'),
    },
  }),
  inject: [ConfigService],
})
```

## Verification

After setup, verify the connection with a simple health check:

```typescript
import { KafkaHealthIndicator } from '@jescrich/nestjs-kafka-client';

@Controller('health')
export class HealthController {
  constructor(private kafkaHealth: KafkaHealthIndicator) {}

  @Get('kafka')
  async checkKafka() {
    return this.kafkaHealth.isHealthy('kafka');
  }
}
```

## Next Steps

- [Set up a Kafka Producer](./producer)
- [Create your first Consumer](./consumer)
- [Explore Advanced Features](./advanced-features)