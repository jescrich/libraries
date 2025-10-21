# Advanced Features

This section covers the enterprise-grade features that make this Kafka client suitable for production environments.

## Pressure Management

### Back Pressure

Back pressure prevents your application from being overwhelmed when it can't keep up with incoming messages.

```typescript
@Consumer('high-load-topic', {
  batch: true,
  batchSize: 100,
  backPressureThreshold: 80, // Pause at 80% capacity
  backPressureStrategy: 'pause', // or 'drop', 'buffer'
})
export class BackPressureConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // When processing falls behind, consumption automatically pauses
    // Resumes when capacity is available
    await this.heavyProcessing(messages);
  }
}
```

#### Back Pressure Strategies

```typescript
// Pause Strategy (Default)
@Consumer('topic', {
  backPressureStrategy: 'pause',
  backPressureThreshold: 80,
})

// Buffer Strategy - Buffer messages up to a limit
@Consumer('topic', {
  backPressureStrategy: 'buffer',
  backPressureThreshold: 80,
  bufferSize: 1000,
})

// Drop Strategy - Drop oldest messages when overwhelmed
@Consumer('topic', {
  backPressureStrategy: 'drop',
  backPressureThreshold: 90,
})
```

### Front Pressure

Front pressure manages the flow when Kafka brokers are overwhelmed.

```typescript
// Automatic front pressure management
KafkaModule.forRoot({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
  
  // Front pressure configuration
  producer: {
    maxInFlightRequests: 5,
    requestTimeout: 30000,
    retry: {
      initialRetryTime: 100,
      retries: 8,
      multiplier: 2,
      maxRetryTime: 30000,
    },
  },
  
  // Circuit breaker for failing brokers
  circuitBreaker: {
    threshold: 5,
    timeout: 60000,
  },
})
```

## Idempotency

### Message-Level Idempotency

```typescript
@Consumer('payments', {
  idempotencyKey: (message) => message.headers['idempotency-key'],
  idempotencyTtl: 3600000, // 1 hour
  idempotencyStorage: 'redis', // or 'memory', 'database'
})
export class IdempotentPaymentConsumer {
  async handleMessage(message: KafkaMessage) {
    // This will only process once per idempotency key
    const payment = JSON.parse(message.value.toString());
    await this.processPayment(payment);
  }
}
```

### Custom Idempotency Logic

```typescript
@Consumer('orders', {
  idempotencyKey: (message) => {
    const order = JSON.parse(message.value.toString());
    return `${order.customerId}-${order.timestamp}`;
  },
  idempotencyValidator: async (key, message) => {
    // Custom validation logic
    const order = JSON.parse(message.value.toString());
    return !(await this.orderExists(order.id));
  },
})
export class CustomIdempotencyConsumer {
  async handleMessage(message: KafkaMessage) {
    // Custom idempotency logic applied
  }
}
```

## Dead Letter Queue (DLQ)

### Basic DLQ Configuration

```typescript
@Consumer('orders', {
  dlq: {
    topic: 'orders-dlq',
    maxRetries: 3,
    retryDelay: 1000,
  }
})
export class OrderConsumer {
  async handleMessage(message: KafkaMessage) {
    // If this fails 3 times, message goes to DLQ
    await this.processOrder(message);
  }
}
```

### Advanced DLQ with Custom Logic

```typescript
@Consumer('payments', {
  dlq: {
    topic: 'payments-dlq',
    maxRetries: 5,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000),
    shouldRetry: (error, message, attempt) => {
      // Custom retry logic
      if (error.code === 'TEMPORARY_ERROR') return true;
      if (error.code === 'VALIDATION_ERROR') return false;
      return attempt < 3;
    },
    onDlq: async (message, error) => {
      // Custom DLQ handling
      await this.notifyAdmins(message, error);
      await this.logFailure(message, error);
    },
  }
})
export class AdvancedDlqConsumer {
  async handleMessage(message: KafkaMessage) {
    await this.processPayment(message);
  }
}
```

### DLQ Processing

```typescript
@Consumer('orders-dlq')
export class DlqProcessor {
  async handleMessage(message: KafkaMessage) {
    // Process failed messages from DLQ
    const originalMessage = JSON.parse(message.value.toString());
    const failureReason = message.headers['failure-reason'];
    
    // Attempt manual processing or alert administrators
    await this.handleFailedOrder(originalMessage, failureReason);
  }
}
```

## Health Monitoring

### Built-in Health Checks

```typescript
import { KafkaHealthIndicator } from '@jescrich/nestjs-kafka-client';

@Controller('health')
export class HealthController {
  constructor(private kafkaHealth: KafkaHealthIndicator) {}

  @Get('kafka')
  async checkKafka() {
    return this.kafkaHealth.isHealthy('kafka');
  }

  @Get('kafka/detailed')
  async detailedKafkaHealth() {
    return this.kafkaHealth.getDetailedHealth();
  }
}
```

### Custom Health Metrics

```typescript
@Injectable()
export class KafkaMetricsService {
  private readonly metrics = {
    messagesProduced: 0,
    messagesConsumed: 0,
    errors: 0,
    avgProcessingTime: 0,
  };

  @EventListener('kafka.message.produced')
  onMessageProduced() {
    this.metrics.messagesProduced++;
  }

  @EventListener('kafka.message.consumed')
  onMessageConsumed(event: { processingTime: number }) {
    this.metrics.messagesConsumed++;
    this.updateAvgProcessingTime(event.processingTime);
  }

  @EventListener('kafka.error')
  onError() {
    this.metrics.errors++;
  }

  getMetrics() {
    return this.metrics;
  }
}
```

## Batch Processing & Key Grouping

### Intelligent Batch Processing

```typescript
@Consumer('analytics-events', {
  batch: true,
  batchSize: 1000,
  batchTimeout: 5000,
  groupByKey: true,
  keyGroupingStrategy: 'round-robin', // or 'hash', 'custom'
})
export class AnalyticsConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Messages are automatically grouped by key
    // Each key group maintains order
    const eventsByUser = this.groupByUser(messages);
    
    // Process each user's events in parallel
    await Promise.all(
      Object.entries(eventsByUser).map(([userId, events]) =>
        this.processUserEvents(userId, events)
      )
    );
  }
}
```

### Custom Key Grouping

```typescript
@Consumer('orders', {
  batch: true,
  groupByKey: true,
  keyGroupingStrategy: 'custom',
  customKeyGrouper: (messages) => {
    // Custom grouping logic
    return messages.reduce((groups, msg) => {
      const order = JSON.parse(msg.value.toString());
      const region = order.shippingAddress.region;
      
      if (!groups[region]) groups[region] = [];
      groups[region].push(msg);
      return groups;
    }, {});
  },
})
export class RegionalOrderConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Messages grouped by region
  }
}
```

## Connection Management

### Connection Pooling

```typescript
KafkaModule.forRoot({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
  
  // Connection pool configuration
  connectionPool: {
    maxConnections: 10,
    idleTimeout: 30000,
    acquireTimeout: 10000,
  },
  
  // Automatic reconnection
  reconnection: {
    enabled: true,
    maxRetries: 10,
    retryDelay: 1000,
  },
})
```

### Failover Configuration

```typescript
KafkaModule.forRoot({
  brokers: [
    'kafka-1.example.com:9092',
    'kafka-2.example.com:9092',
    'kafka-3.example.com:9092',
  ],
  
  // Failover settings
  failover: {
    strategy: 'round-robin', // or 'random', 'priority'
    healthCheckInterval: 30000,
    maxFailedAttempts: 3,
  },
})
```

## Graceful Shutdown

### Automatic Graceful Shutdown

```typescript
@Injectable()
export class AppService implements OnApplicationShutdown {
  constructor(private kafkaClient: KafkaClient) {}

  async onApplicationShutdown(signal?: string) {
    // Automatic graceful shutdown
    // - Stops accepting new messages
    // - Completes processing of in-flight messages
    // - Commits offsets
    // - Closes connections
    
    await this.kafkaClient.shutdown();
  }
}
```

### Custom Shutdown Logic

```typescript
@Consumer('orders', {
  gracefulShutdown: {
    timeout: 30000, // 30 seconds to complete processing
    forceShutdown: true, // Force shutdown after timeout
  }
})
export class GracefulOrderConsumer {
  private isShuttingDown = false;

  async handleMessage(message: KafkaMessage) {
    if (this.isShuttingDown) {
      // Skip processing during shutdown
      return;
    }
    
    await this.processOrder(message);
  }

  @EventListener('kafka.shutdown.start')
  onShutdownStart() {
    this.isShuttingDown = true;
  }
}
```

## Performance Optimization

### Memory Management

```typescript
@Consumer('large-messages', {
  batch: true,
  batchSize: 100,
  
  // Memory management
  memoryManagement: {
    maxMemoryUsage: '512MB',
    gcThreshold: 0.8,
    streamProcessing: true, // Process without loading all into memory
  },
})
export class MemoryEfficientConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Streaming processing for large batches
    for await (const chunk of this.chunkMessages(messages, 10)) {
      await this.processChunk(chunk);
    }
  }
}
```

### Compression and Serialization

```typescript
// Producer with compression
await this.kafkaClient.send('topic', {
  key: 'key',
  value: largePayload,
}, {
  compression: 'gzip',
  serializer: 'avro',
});

// Consumer with custom deserialization
@Consumer('compressed-topic', {
  deserializer: 'avro',
  compression: 'gzip',
})
export class CompressedConsumer {
  async handleMessage(message: KafkaMessage) {
    // Automatic decompression and deserialization
  }
}
```

## Next Steps

- [Review Configuration Options](./configuration)
- [Learn Best Practices](./best-practices)
- [Troubleshooting Guide](./troubleshooting)