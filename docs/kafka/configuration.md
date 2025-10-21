---
sidebar_position: 3
---
# Configuration

Complete configuration reference for the NestJS Kafka Client.

## Module Configuration

### Basic Configuration

```typescript
KafkaModule.forRoot({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
})
```

### Complete Configuration Options

```typescript
KafkaModule.forRoot({
  // Basic connection settings
  clientId: 'my-production-app',
  brokers: ['kafka-1:9092', 'kafka-2:9092', 'kafka-3:9092'],
  
  // SSL Configuration
  ssl: {
    rejectUnauthorized: true,
    ca: [fs.readFileSync('/path/to/ca-cert.pem', 'utf-8')],
    key: fs.readFileSync('/path/to/client-key.pem', 'utf-8'),
    cert: fs.readFileSync('/path/to/client-cert.pem', 'utf-8'),
  },
  
  // SASL Authentication
  sasl: {
    mechanism: 'scram-sha-256', // 'plain', 'scram-sha-256', 'scram-sha-512'
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
  
  // Connection settings
  connectionTimeout: 3000,
  authenticationTimeout: 1000,
  reauthenticationThreshold: 10000,
  requestTimeout: 30000,
  enforceRequestTimeout: false,
  
  // Retry configuration
  retry: {
    initialRetryTime: 100,
    retries: 8,
    maxRetryTime: 30000,
    factor: 0.2,
    multiplier: 2,
    restartOnFailure: async (e) => Promise.resolve(true),
  },
  
  // Socket configuration
  socketFactory: ({ host, port, ssl, onConnect }) => {
    const socket = net.createConnection({ host, port });
    socket.on('connect', onConnect);
    return socket;
  },
  
  // Logging
  logLevel: 'info', // 'debug', 'info', 'warn', 'error', 'nothing'
  logCreator: (logLevel) => ({ namespace, level, label, log }) => {
    console.log(`[${namespace}] ${level}: ${log.message}`);
  },
})
```

## Producer Configuration

### Basic Producer Settings

```typescript
KafkaModule.forRoot({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
  
  producer: {
    // Performance settings
    maxInFlightRequests: 5,
    idempotent: true,
    transactionTimeout: 30000,
    
    // Batching
    allowAutoTopicCreation: false,
    transactionTimeout: 30000,
    
    // Retry settings
    retry: {
      initialRetryTime: 100,
      retries: 5,
      maxRetryTime: 30000,
    },
  },
})
```

### Advanced Producer Configuration

```typescript
producer: {
  // Idempotency and transactions
  idempotent: true,
  maxInFlightRequests: 5,
  transactionTimeout: 30000,
  
  // Compression
  compression: 'gzip', // 'none', 'gzip', 'snappy', 'lz4', 'zstd'
  
  // Batching configuration
  batch: {
    size: 16384, // 16KB
    lingerMs: 5, // Wait up to 5ms for more messages
  },
  
  // Partitioning
  partitioner: 'default', // 'default', 'round-robin', 'random'
  
  // Metadata refresh
  metadataMaxAge: 300000, // 5 minutes
  
  // Custom serializers
  keySerializer: (key) => Buffer.from(key),
  valueSerializer: (value) => Buffer.from(JSON.stringify(value)),
}
```

## Consumer Configuration

### Basic Consumer Settings

```typescript
@Consumer('my-topic', {
  groupId: 'my-consumer-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
})
```

### Complete Consumer Configuration

```typescript
@Consumer('my-topic', {
  // Consumer group settings
  groupId: 'my-consumer-group',
  sessionTimeout: 30000,
  rebalanceTimeout: 60000,
  heartbeatInterval: 3000,
  
  // Offset management
  fromBeginning: false,
  autoCommit: true,
  autoCommitInterval: 5000,
  autoCommitThreshold: null,
  
  // Fetch settings
  minBytes: 1,
  maxBytes: 1048576, // 1MB
  maxWaitTimeInMs: 5000,
  
  // Batch processing
  batch: true,
  batchSize: 100,
  batchTimeout: 5000,
  
  // Key grouping
  groupByKey: true,
  keyGroupingStrategy: 'hash', // 'hash', 'round-robin', 'custom'
  
  // Pressure management
  maxConcurrency: 5,
  backPressureThreshold: 80,
  backPressureStrategy: 'pause', // 'pause', 'drop', 'buffer'
  
  // Idempotency
  idempotencyKey: (msg) => msg.headers['idempotency-key'],
  idempotencyTtl: 3600000, // 1 hour
  idempotencyStorage: 'redis', // 'memory', 'redis', 'database'
  
  // Dead Letter Queue
  dlq: {
    topic: 'my-topic-dlq',
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
  },
  
  // Graceful shutdown
  gracefulShutdown: {
    timeout: 30000,
    forceShutdown: true,
  },
  
  // Custom deserializers
  keyDeserializer: (key) => key.toString(),
  valueDeserializer: (value) => JSON.parse(value.toString()),
})
```

## Environment-Based Configuration

### Development Configuration

```typescript
// config/kafka.dev.ts
export const kafkaConfig = {
  clientId: 'my-app-dev',
  brokers: ['localhost:9092'],
  logLevel: 'debug',
  
  producer: {
    allowAutoTopicCreation: true,
    idempotent: false, // Simpler for development
  },
  
  consumer: {
    fromBeginning: true, // Start from beginning in dev
    autoCommit: true,
  },
};
```

### Production Configuration

```typescript
// config/kafka.prod.ts
export const kafkaConfig = {
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: process.env.KAFKA_BROKERS.split(','),
  logLevel: 'warn',
  
  ssl: {
    rejectUnauthorized: true,
    ca: [fs.readFileSync(process.env.KAFKA_CA_CERT, 'utf-8')],
    key: fs.readFileSync(process.env.KAFKA_CLIENT_KEY, 'utf-8'),
    cert: fs.readFileSync(process.env.KAFKA_CLIENT_CERT, 'utf-8'),
  },
  
  sasl: {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
  
  producer: {
    idempotent: true,
    maxInFlightRequests: 5,
    transactionTimeout: 30000,
    compression: 'gzip',
  },
  
  consumer: {
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    autoCommit: true,
    autoCommitInterval: 5000,
  },
};
```

### Async Configuration

```typescript
KafkaModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => {
    const environment = configService.get('NODE_ENV');
    
    const baseConfig = {
      clientId: configService.get('KAFKA_CLIENT_ID'),
      brokers: configService.get('KAFKA_BROKERS').split(','),
    };
    
    if (environment === 'production') {
      return {
        ...baseConfig,
        ssl: {
          rejectUnauthorized: true,
          ca: [await fs.promises.readFile(configService.get('KAFKA_CA_CERT'), 'utf-8')],
          key: await fs.promises.readFile(configService.get('KAFKA_CLIENT_KEY'), 'utf-8'),
          cert: await fs.promises.readFile(configService.get('KAFKA_CLIENT_CERT'), 'utf-8'),
        },
        sasl: {
          mechanism: 'scram-sha-256',
          username: configService.get('KAFKA_USERNAME'),
          password: configService.get('KAFKA_PASSWORD'),
        },
      };
    }
    
    return baseConfig;
  },
  inject: [ConfigService],
})
```

## Advanced Configuration Options

### Connection Pool Configuration

```typescript
connectionPool: {
  maxConnections: 10,
  idleTimeout: 30000,
  acquireTimeout: 10000,
  evictionRunIntervalMillis: 30000,
  numTestsPerEvictionRun: 3,
  softIdleTimeoutMillis: 30000,
  testOnBorrow: true,
  testOnReturn: false,
  testWhileIdle: true,
}
```

### Circuit Breaker Configuration

```typescript
circuitBreaker: {
  threshold: 5, // Number of failures before opening
  timeout: 60000, // Time to wait before trying again
  monitor: true, // Enable monitoring
  onOpen: () => console.log('Circuit breaker opened'),
  onHalfOpen: () => console.log('Circuit breaker half-open'),
  onClose: () => console.log('Circuit breaker closed'),
}
```

### Health Check Configuration

```typescript
healthCheck: {
  enabled: true,
  interval: 30000, // Check every 30 seconds
  timeout: 5000, // Timeout after 5 seconds
  retries: 3,
  
  // Custom health check
  customCheck: async (kafka) => {
    const admin = kafka.admin();
    await admin.connect();
    const metadata = await admin.fetchTopicMetadata();
    await admin.disconnect();
    return metadata.topics.length > 0;
  },
}
```

### Monitoring Configuration

```typescript
monitoring: {
  enabled: true,
  metricsInterval: 10000, // Collect metrics every 10 seconds
  
  // Custom metrics collector
  metricsCollector: (metrics) => {
    // Send to your monitoring system
    console.log('Kafka metrics:', metrics);
  },
  
  // Event listeners
  events: {
    'producer.connect': () => console.log('Producer connected'),
    'consumer.connect': () => console.log('Consumer connected'),
    'error': (error) => console.error('Kafka error:', error),
  },
}
```

## Configuration Validation

### Schema Validation

```typescript
import * as Joi from 'joi';

const kafkaConfigSchema = Joi.object({
  clientId: Joi.string().required(),
  brokers: Joi.array().items(Joi.string()).min(1).required(),
  ssl: Joi.object({
    rejectUnauthorized: Joi.boolean(),
    ca: Joi.array().items(Joi.string()),
    key: Joi.string(),
    cert: Joi.string(),
  }).optional(),
  sasl: Joi.object({
    mechanism: Joi.string().valid('plain', 'scram-sha-256', 'scram-sha-512'),
    username: Joi.string().required(),
    password: Joi.string().required(),
  }).optional(),
});

// Validate configuration
const { error, value } = kafkaConfigSchema.validate(config);
if (error) {
  throw new Error(`Invalid Kafka configuration: ${error.message}`);
}
```

### Runtime Configuration Updates

```typescript
@Injectable()
export class KafkaConfigService {
  private config: KafkaConfig;

  async updateConfig(newConfig: Partial<KafkaConfig>) {
    // Validate new configuration
    const validatedConfig = await this.validateConfig(newConfig);
    
    // Apply configuration changes
    this.config = { ...this.config, ...validatedConfig };
    
    // Restart connections if needed
    await this.restartConnections();
  }

  private async restartConnections() {
    // Gracefully restart Kafka connections with new config
  }
}
```

## Environment Variables Reference

```bash
# Basic connection
KAFKA_CLIENT_ID=my-app
KAFKA_BROKERS=kafka-1:9092,kafka-2:9092,kafka-3:9092

# Authentication
KAFKA_USERNAME=your-username
KAFKA_PASSWORD=your-password
KAFKA_SASL_MECHANISM=scram-sha-256

# SSL
KAFKA_SSL=true
KAFKA_CA_CERT=/path/to/ca-cert.pem
KAFKA_CLIENT_KEY=/path/to/client-key.pem
KAFKA_CLIENT_CERT=/path/to/client-cert.pem

# Performance
KAFKA_MAX_IN_FLIGHT_REQUESTS=5
KAFKA_REQUEST_TIMEOUT=30000
KAFKA_CONNECTION_TIMEOUT=3000

# Consumer settings
KAFKA_CONSUMER_GROUP_ID=my-consumer-group
KAFKA_SESSION_TIMEOUT=30000
KAFKA_HEARTBEAT_INTERVAL=3000

# Batch processing
KAFKA_BATCH_SIZE=100
KAFKA_BATCH_TIMEOUT=5000
KAFKA_MAX_CONCURRENCY=5

# Monitoring
KAFKA_LOG_LEVEL=info
KAFKA_HEALTH_CHECK_INTERVAL=30000
```

## Next Steps

- [Learn Best Practices](./best-practices)
- [Troubleshooting Guide](./troubleshooting)
- [Back to Overview](./index)