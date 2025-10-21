# Best Practices

This guide covers production-ready best practices for using the NestJS Kafka Client effectively and safely.

## Message Design

### Use Meaningful Keys

```typescript
// ✅ Good: Use meaningful keys for partitioning
await this.kafkaClient.send('orders', {
  key: order.customerId, // Groups orders by customer
  value: JSON.stringify(order),
});

// ❌ Bad: Random or no keys
await this.kafkaClient.send('orders', {
  key: Math.random().toString(), // Defeats partitioning
  value: JSON.stringify(order),
});
```

### Include Idempotency Keys

```typescript
// ✅ Good: Always include idempotency keys for critical operations
await this.kafkaClient.send('payments', {
  key: payment.orderId,
  value: JSON.stringify(payment),
  headers: {
    'idempotency-key': payment.transactionId,
    'timestamp': new Date().toISOString(),
    'version': '1.0',
  },
});
```

### Message Schema Evolution

```typescript
// ✅ Good: Design for schema evolution
interface OrderEventV1 {
  version: '1.0';
  orderId: string;
  customerId: string;
  amount: number;
  // New fields should be optional
  currency?: string;
}

interface OrderEventV2 {
  version: '2.0';
  orderId: string;
  customerId: string;
  amount: number;
  currency: string; // Now required
  // Always keep backward compatibility
  items?: OrderItem[];
}
```

## Consumer Design Patterns

### Batch Processing for High Throughput

```typescript
// ✅ Good: Use batch processing for high-volume topics
@Consumer('analytics-events', {
  batch: true,
  batchSize: 500,
  batchTimeout: 5000,
  groupByKey: true,
})
export class AnalyticsConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Process in chunks to avoid memory issues
    const chunks = this.chunkArray(messages, 100);
    
    for (const chunk of chunks) {
      await this.processChunk(chunk);
    }
  }
}
```

### Single Message Processing for Low Latency

```typescript
// ✅ Good: Use single message processing for real-time requirements
@Consumer('fraud-alerts', {
  batch: false, // Process immediately
  maxConcurrency: 10,
})
export class FraudAlertConsumer {
  async handleMessage(message: KafkaMessage) {
    const alert = JSON.parse(message.value.toString());
    
    // Immediate processing for time-sensitive alerts
    await this.processFraudAlert(alert);
  }
}
```

### Error Handling Strategy

```typescript
// ✅ Good: Comprehensive error handling
@Consumer('orders', {
  dlq: {
    topic: 'orders-dlq',
    maxRetries: 3,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000),
    shouldRetry: (error, message, attempt) => {
      // Don't retry validation errors
      if (error.name === 'ValidationError') return false;
      
      // Don't retry after 3 attempts for business logic errors
      if (error.name === 'BusinessLogicError' && attempt >= 3) return false;
      
      // Retry transient errors
      return error.name === 'TransientError';
    },
  },
})
export class OrderConsumer {
  private readonly logger = new Logger(OrderConsumer.name);

  async handleMessage(message: KafkaMessage) {
    try {
      const order = this.validateOrder(message);
      await this.processOrder(order);
    } catch (error) {
      this.logger.error(`Order processing failed: ${error.message}`, {
        orderId: message.headers['order-id'],
        error: error.stack,
      });
      throw error; // Let DLQ handle it
    }
  }

  private validateOrder(message: KafkaMessage): Order {
    // Throw ValidationError for invalid messages
    // These won't be retried
  }
}
```

## Performance Optimization

### Batch Size Tuning

```typescript
// ✅ Good: Tune batch sizes based on message size and processing time
@Consumer('small-messages', {
  batch: true,
  batchSize: 1000, // Larger batches for small messages
  batchTimeout: 2000,
})
export class SmallMessageConsumer {}

@Consumer('large-messages', {
  batch: true,
  batchSize: 10, // Smaller batches for large messages
  batchTimeout: 10000,
})
export class LargeMessageConsumer {}
```

### Memory Management

```typescript
// ✅ Good: Process large batches in chunks
@Consumer('large-volume-topic', {
  batch: true,
  batchSize: 1000,
})
export class MemoryEfficientConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Process in smaller chunks to manage memory
    const chunkSize = 50;
    
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      await this.processChunk(chunk);
      
      // Optional: Force garbage collection for very large batches
      if (i % 500 === 0) {
        global.gc?.();
      }
    }
  }
}
```

### Connection Optimization

```typescript
// ✅ Good: Optimize connection settings for your environment
KafkaModule.forRoot({
  clientId: 'my-app',
  brokers: ['kafka-1:9092', 'kafka-2:9092'],
  
  // Optimize for your network conditions
  connectionTimeout: 3000,
  requestTimeout: 30000,
  
  // Producer optimization
  producer: {
    maxInFlightRequests: 5, // Balance throughput vs memory
    idempotent: true, // Prevent duplicates
    compression: 'gzip', // Reduce network usage
  },
  
  // Consumer optimization
  consumer: {
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytes: 1048576, // 1MB - adjust based on message size
  },
})
```

## Monitoring and Observability

### Comprehensive Logging

```typescript
@Consumer('orders')
export class OrderConsumer {
  private readonly logger = new Logger(OrderConsumer.name);

  async handleMessage(message: KafkaMessage) {
    const startTime = Date.now();
    const orderId = message.headers['order-id'];
    
    this.logger.log(`Processing order ${orderId}`, {
      partition: message.partition,
      offset: message.offset,
    });

    try {
      await this.processOrder(message);
      
      const duration = Date.now() - startTime;
      this.logger.log(`Order ${orderId} processed successfully in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Order ${orderId} processing failed`, {
        error: error.message,
        stack: error.stack,
        partition: message.partition,
        offset: message.offset,
      });
      throw error;
    }
  }
}
```

### Metrics Collection

```typescript
@Injectable()
export class KafkaMetricsService {
  private readonly metrics = new Map<string, number>();

  @EventListener('kafka.message.consumed')
  onMessageConsumed(event: { topic: string; processingTime: number }) {
    this.incrementCounter(`messages.consumed.${event.topic}`);
    this.recordHistogram(`processing.time.${event.topic}`, event.processingTime);
  }

  @EventListener('kafka.error')
  onError(event: { topic: string; error: Error }) {
    this.incrementCounter(`errors.${event.topic}.${event.error.name}`);
  }

  @Cron('0 * * * * *') // Every minute
  reportMetrics() {
    // Send metrics to your monitoring system
    this.sendToMonitoring(Object.fromEntries(this.metrics));
    this.metrics.clear();
  }
}
```

### Health Checks

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private kafkaHealth: KafkaHealthIndicator,
    private metricsService: KafkaMetricsService,
  ) {}

  @Get('kafka')
  async checkKafka() {
    const health = await this.kafkaHealth.isHealthy('kafka');
    const metrics = this.metricsService.getMetrics();
    
    return {
      ...health,
      metrics: {
        messagesPerMinute: metrics.messagesConsumed,
        errorRate: metrics.errors / metrics.messagesConsumed,
        avgProcessingTime: metrics.avgProcessingTime,
      },
    };
  }
}
```

## Security Best Practices

### Authentication and Authorization

```typescript
// ✅ Good: Use strong authentication
KafkaModule.forRoot({
  clientId: 'my-app',
  brokers: ['kafka:9092'],
  
  ssl: {
    rejectUnauthorized: true,
    ca: [fs.readFileSync('/certs/ca-cert.pem', 'utf-8')],
    key: fs.readFileSync('/certs/client-key.pem', 'utf-8'),
    cert: fs.readFileSync('/certs/client-cert.pem', 'utf-8'),
  },
  
  sasl: {
    mechanism: 'scram-sha-256', // Use strong SASL mechanism
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
})
```

### Message Encryption

```typescript
// ✅ Good: Encrypt sensitive data
@Injectable()
export class SecureOrderService {
  constructor(
    private kafkaClient: KafkaClient,
    private encryptionService: EncryptionService,
  ) {}

  async createOrder(order: Order) {
    // Encrypt sensitive fields
    const encryptedOrder = {
      ...order,
      customerData: await this.encryptionService.encrypt(order.customerData),
      paymentInfo: await this.encryptionService.encrypt(order.paymentInfo),
    };

    await this.kafkaClient.send('orders', {
      key: order.customerId,
      value: JSON.stringify(encryptedOrder),
      headers: {
        'encryption-version': '1.0',
      },
    });
  }
}
```

### Input Validation

```typescript
// ✅ Good: Always validate input
@Consumer('orders')
export class OrderConsumer {
  async handleMessage(message: KafkaMessage) {
    // Validate message structure
    const order = this.validateAndParseOrder(message);
    
    // Sanitize input
    const sanitizedOrder = this.sanitizeOrder(order);
    
    await this.processOrder(sanitizedOrder);
  }

  private validateAndParseOrder(message: KafkaMessage): Order {
    try {
      const order = JSON.parse(message.value.toString());
      
      // Use a validation library like Joi or class-validator
      const { error, value } = orderSchema.validate(order);
      if (error) {
        throw new ValidationError(`Invalid order: ${error.message}`);
      }
      
      return value;
    } catch (error) {
      throw new ValidationError(`Failed to parse order: ${error.message}`);
    }
  }
}
```

## Deployment Best Practices

### Environment Configuration

```typescript
// ✅ Good: Environment-specific configuration
const getKafkaConfig = (): KafkaModuleOptions => {
  const environment = process.env.NODE_ENV;
  
  const baseConfig = {
    clientId: process.env.KAFKA_CLIENT_ID,
    brokers: process.env.KAFKA_BROKERS.split(','),
  };

  switch (environment) {
    case 'development':
      return {
        ...baseConfig,
        logLevel: 'debug',
        producer: { allowAutoTopicCreation: true },
      };
      
    case 'staging':
      return {
        ...baseConfig,
        logLevel: 'info',
        ssl: true,
        sasl: {
          mechanism: 'scram-sha-256',
          username: process.env.KAFKA_USERNAME,
          password: process.env.KAFKA_PASSWORD,
        },
      };
      
    case 'production':
      return {
        ...baseConfig,
        logLevel: 'warn',
        ssl: {
          rejectUnauthorized: true,
          ca: [fs.readFileSync('/certs/ca-cert.pem', 'utf-8')],
          key: fs.readFileSync('/certs/client-key.pem', 'utf-8'),
          cert: fs.readFileSync('/certs/client-cert.pem', 'utf-8'),
        },
        sasl: {
          mechanism: 'scram-sha-256',
          username: process.env.KAFKA_USERNAME,
          password: process.env.KAFKA_PASSWORD,
        },
        producer: {
          idempotent: true,
          maxInFlightRequests: 5,
        },
      };
      
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
};
```

### Graceful Shutdown

```typescript
// ✅ Good: Implement proper shutdown handling
@Injectable()
export class AppService implements OnApplicationShutdown {
  constructor(private kafkaClient: KafkaClient) {}

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Received shutdown signal: ${signal}`);
    
    // Stop accepting new messages
    await this.kafkaClient.pause();
    
    // Wait for in-flight messages to complete
    await this.waitForInFlightMessages();
    
    // Gracefully disconnect
    await this.kafkaClient.disconnect();
    
    this.logger.log('Kafka client shutdown complete');
  }

  private async waitForInFlightMessages(timeout = 30000): Promise<void> {
    const start = Date.now();
    
    while (this.hasInFlightMessages() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

## Testing Best Practices

### Unit Testing Consumers

```typescript
describe('OrderConsumer', () => {
  let consumer: OrderConsumer;
  let orderService: jest.Mocked<OrderService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrderConsumer,
        {
          provide: OrderService,
          useValue: {
            processOrder: jest.fn(),
          },
        },
      ],
    }).compile();

    consumer = module.get<OrderConsumer>(OrderConsumer);
    orderService = module.get(OrderService);
  });

  it('should process valid order message', async () => {
    const message: KafkaMessage = {
      key: Buffer.from('customer-123'),
      value: Buffer.from(JSON.stringify({ id: 'order-456' })),
      headers: {},
      partition: 0,
      offset: '100',
    };

    await consumer.handleMessage(message);

    expect(orderService.processOrder).toHaveBeenCalledWith({ id: 'order-456' });
  });
});
```

### Integration Testing

```typescript
describe('Kafka Integration', () => {
  let app: INestApplication;
  let kafkaClient: KafkaClient;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        KafkaModule.forRoot({
          clientId: 'test-client',
          brokers: ['localhost:9092'],
        }),
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    
    kafkaClient = app.get(KafkaClient);
  });

  it('should send and receive messages', async () => {
    const testMessage = { id: 'test-123' };
    
    // Send message
    await kafkaClient.send('test-topic', {
      key: 'test-key',
      value: JSON.stringify(testMessage),
    });

    // Verify message was received (implementation depends on your test setup)
    // This might involve checking a test consumer or database
  });
});
```

## Common Anti-Patterns to Avoid

### ❌ Don't Block the Event Loop

```typescript
// ❌ Bad: Synchronous processing
@Consumer('orders')
export class BadOrderConsumer {
  handleMessage(message: KafkaMessage) {
    // This blocks the event loop
    const result = this.heavyComputationSync(message);
    return result;
  }
}

// ✅ Good: Asynchronous processing
@Consumer('orders')
export class GoodOrderConsumer {
  async handleMessage(message: KafkaMessage) {
    // Non-blocking async processing
    const result = await this.heavyComputationAsync(message);
    return result;
  }
}
```

### ❌ Don't Ignore Errors

```typescript
// ❌ Bad: Swallowing errors
@Consumer('orders')
export class BadErrorHandling {
  async handleMessage(message: KafkaMessage) {
    try {
      await this.processOrder(message);
    } catch (error) {
      console.log('Error occurred'); // Error is lost
    }
  }
}

// ✅ Good: Proper error handling
@Consumer('orders')
export class GoodErrorHandling {
  async handleMessage(message: KafkaMessage) {
    try {
      await this.processOrder(message);
    } catch (error) {
      this.logger.error('Order processing failed', error);
      throw error; // Let the framework handle retries/DLQ
    }
  }
}
```

### ❌ Don't Create Too Many Connections

```typescript
// ❌ Bad: Creating multiple clients
@Injectable()
export class BadKafkaService {
  async sendMessage() {
    const client = new KafkaClient(config); // New connection each time
    await client.send('topic', message);
  }
}

// ✅ Good: Reuse connections
@Injectable()
export class GoodKafkaService {
  constructor(private kafkaClient: KafkaClient) {} // Injected singleton

  async sendMessage() {
    await this.kafkaClient.send('topic', message);
  }
}
```

## Next Steps

- [Troubleshooting Guide](./troubleshooting)
- [Configuration Reference](./configuration)
- [Back to Overview](./index)