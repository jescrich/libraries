---
title: Troubleshooting Guide - NestJS Kafka Issues
description: Comprehensive troubleshooting guide for NestJS Kafka client covering connection issues, consumer lag, memory problems, SSL/SASL errors, and performance optimization.
keywords: [Kafka Troubleshooting, NestJS Debugging, Connection Issues, Consumer Lag, Memory Issues, SSL Errors, SASL Problems, Performance Issues]
---

# Troubleshooting

Common issues and solutions when using the NestJS Kafka Client.

## Connection Issues

### Cannot Connect to Kafka Brokers

**Symptoms:**
- Connection timeout errors
- "Failed to connect to broker" messages
- Application startup failures

**Solutions:**

```typescript
// Check broker connectivity
KafkaModule.forRoot({
  clientId: 'my-app',
  brokers: ['localhost:9092'], // Verify broker addresses
  connectionTimeout: 10000, // Increase timeout
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
})
```

**Debugging Steps:**
1. Verify broker addresses and ports
2. Check network connectivity: `telnet kafka-broker 9092`
3. Verify firewall rules
4. Check Kafka broker logs

### SSL/TLS Connection Failures

**Symptoms:**
- SSL handshake failures
- Certificate verification errors
- "unable to verify the first certificate" errors

**Solutions:**

```typescript
// Proper SSL configuration
KafkaModule.forRoot({
  ssl: {
    rejectUnauthorized: true,
    ca: [fs.readFileSync('/path/to/ca-cert.pem', 'utf-8')],
    key: fs.readFileSync('/path/to/client-key.pem', 'utf-8'),
    cert: fs.readFileSync('/path/to/client-cert.pem', 'utf-8'),
  },
})

// For development (not recommended for production)
KafkaModule.forRoot({
  ssl: {
    rejectUnauthorized: false, // Only for development
  },
})
```

**Debugging Steps:**
1. Verify certificate paths and permissions
2. Check certificate validity: `openssl x509 -in cert.pem -text -noout`
3. Verify CA certificate chain
4. Test SSL connection: `openssl s_client -connect kafka-broker:9092`

### SASL Authentication Failures

**Symptoms:**
- Authentication failed errors
- "Invalid username or password" messages
- Connection drops after initial connect

**Solutions:**

```typescript
// Correct SASL configuration
KafkaModule.forRoot({
  sasl: {
    mechanism: 'scram-sha-256', // Match broker configuration
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },
})
```

**Debugging Steps:**
1. Verify username and password
2. Check SASL mechanism matches broker configuration
3. Verify user permissions in Kafka ACLs
4. Check broker SASL configuration

## Consumer Issues

### High Consumer Lag

**Symptoms:**
- Messages piling up in topics
- Slow message processing
- Consumer group lag alerts

**Solutions:**

```typescript
// Increase processing capacity
@Consumer('high-volume-topic', {
  batch: true,
  batchSize: 500, // Increase batch size
  maxConcurrency: 10, // Increase concurrency
  batchTimeout: 2000, // Reduce timeout for faster processing
})
export class OptimizedConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Process in parallel chunks
    const chunks = this.chunkArray(messages, 50);
    await Promise.all(chunks.map(chunk => this.processChunk(chunk)));
  }
}
```

**Debugging Steps:**
1. Monitor consumer group lag: `kafka-consumer-groups.sh --describe --group my-group`
2. Check processing time per message
3. Verify consumer is not blocked by downstream services
4. Scale consumer instances horizontally

### Consumer Not Receiving Messages

**Symptoms:**
- Consumer connects but receives no messages
- Messages visible in topic but not consumed
- Consumer group shows no active members

**Solutions:**

```typescript
// Check consumer configuration
@Consumer('my-topic', {
  groupId: 'my-consumer-group', // Verify group ID
  fromBeginning: true, // Start from beginning if needed
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
})
export class DebuggingConsumer {
  async handleMessage(message: KafkaMessage) {
    console.log('Received message:', message);
  }
}
```

**Debugging Steps:**
1. Verify topic exists and has messages
2. Check consumer group membership
3. Verify partition assignment
4. Check for consumer group rebalancing issues

### Memory Issues with Large Batches

**Symptoms:**
- Out of memory errors
- Application crashes during batch processing
- High memory usage spikes

**Solutions:**

```typescript
// Memory-efficient batch processing
@Consumer('large-messages', {
  batch: true,
  batchSize: 50, // Reduce batch size
  memoryManagement: {
    maxMemoryUsage: '512MB',
    streamProcessing: true,
  },
})
export class MemoryEfficientConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Process in smaller chunks
    for (let i = 0; i < messages.length; i += 10) {
      const chunk = messages.slice(i, i + 10);
      await this.processChunk(chunk);
      
      // Force garbage collection if available
      if (global.gc && i % 100 === 0) {
        global.gc();
      }
    }
  }
}
```

## Producer Issues

### Message Send Failures

**Symptoms:**
- "Request timed out" errors
- Messages not appearing in topics
- Producer connection drops

**Solutions:**

```typescript
// Robust producer configuration
KafkaModule.forRoot({
  producer: {
    maxInFlightRequests: 5,
    idempotent: true,
    requestTimeout: 30000,
    retry: {
      initialRetryTime: 100,
      retries: 5,
      maxRetryTime: 30000,
    },
  },
})

// Implement retry logic in service
@Injectable()
export class RobustProducerService {
  async sendWithRetry(topic: string, message: any, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.kafkaClient.send(topic, message);
        return;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await this.sleep(delay);
      }
    }
  }
}
```

### Duplicate Messages

**Symptoms:**
- Same message processed multiple times
- Idempotency key violations
- Data inconsistencies

**Solutions:**

```typescript
// Enable idempotent producer
KafkaModule.forRoot({
  producer: {
    idempotent: true, // Prevents duplicates at producer level
    maxInFlightRequests: 5,
  },
})

// Implement consumer-side idempotency
@Consumer('orders', {
  idempotencyKey: (msg) => msg.headers['idempotency-key'],
  idempotencyTtl: 3600000, // 1 hour
})
export class IdempotentConsumer {
  async handleMessage(message: KafkaMessage) {
    // Automatically deduplicated by framework
    await this.processOrder(message);
  }
}
```

## Performance Issues

### Low Throughput

**Symptoms:**
- Messages processed slowly
- High latency between send and receive
- Poor application performance

**Solutions:**

```typescript
// Optimize for throughput
KafkaModule.forRoot({
  producer: {
    compression: 'gzip', // Reduce network usage
    batch: {
      size: 16384, // 16KB batches
      lingerMs: 5, // Wait 5ms for more messages
    },
  },
})

@Consumer('high-throughput-topic', {
  batch: true,
  batchSize: 1000, // Large batches
  batchTimeout: 1000, // Quick processing
  maxConcurrency: 20, // High concurrency
})
export class HighThroughputConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Parallel processing
    await Promise.all(
      this.chunkArray(messages, 100).map(chunk => 
        this.processChunk(chunk)
      )
    );
  }
}
```

### High Latency

**Symptoms:**
- Long delays between message send and processing
- Slow response times
- Poor user experience

**Solutions:**

```typescript
// Optimize for low latency
@Consumer('real-time-alerts', {
  batch: false, // Process immediately
  maxConcurrency: 50, // High concurrency for parallel processing
})
export class LowLatencyConsumer {
  async handleMessage(message: KafkaMessage) {
    // Immediate processing
    await this.processAlert(message);
  }
}

// Reduce producer batching for low latency
KafkaModule.forRoot({
  producer: {
    batch: {
      lingerMs: 0, // Send immediately
    },
  },
})
```

## Error Handling Issues

### Messages Stuck in DLQ

**Symptoms:**
- High number of messages in dead letter queue
- Repeated processing failures
- Error alerts from DLQ monitoring

**Solutions:**

```typescript
// Analyze and process DLQ messages
@Consumer('orders-dlq')
export class DlqProcessor {
  async handleMessage(message: KafkaMessage) {
    const originalMessage = JSON.parse(message.value.toString());
    const failureReason = message.headers['failure-reason'];
    
    // Log for analysis
    this.logger.error('DLQ message analysis', {
      originalMessage,
      failureReason,
      retryCount: message.headers['retry-count'],
    });
    
    // Attempt manual processing or alert administrators
    if (this.canReprocess(failureReason)) {
      await this.reprocessMessage(originalMessage);
    } else {
      await this.alertAdministrators(originalMessage, failureReason);
    }
  }
}
```

### Infinite Retry Loops

**Symptoms:**
- Same message retried continuously
- High CPU usage from retry attempts
- Consumer appears stuck

**Solutions:**

```typescript
// Implement smart retry logic
@Consumer('orders', {
  dlq: {
    topic: 'orders-dlq',
    maxRetries: 3,
    shouldRetry: (error, message, attempt) => {
      // Don't retry validation errors
      if (error.name === 'ValidationError') return false;
      
      // Don't retry after max attempts
      if (attempt >= 3) return false;
      
      // Only retry transient errors
      return ['NetworkError', 'TimeoutError'].includes(error.name);
    },
  },
})
export class SmartRetryConsumer {
  async handleMessage(message: KafkaMessage) {
    try {
      await this.processMessage(message);
    } catch (error) {
      // Classify error for retry decision
      error.name = this.classifyError(error);
      throw error;
    }
  }
}
```

## Monitoring and Debugging

### Enable Debug Logging

```typescript
// Enable detailed logging
KafkaModule.forRoot({
  logLevel: 'debug',
  logCreator: (logLevel) => ({ namespace, level, label, log }) => {
    console.log(`[${new Date().toISOString()}] [${namespace}] ${level}: ${log.message}`, log);
  },
})
```

### Health Check Failures

```typescript
// Comprehensive health checks
@Injectable()
export class KafkaHealthService {
  constructor(private kafkaHealth: KafkaHealthIndicator) {}

  async checkHealth() {
    try {
      const health = await this.kafkaHealth.isHealthy('kafka');
      
      if (!health.kafka.status === 'up') {
        // Investigate connection issues
        await this.diagnoseConnection();
      }
      
      return health;
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }

  private async diagnoseConnection() {
    // Check broker connectivity
    // Verify authentication
    // Test topic access
  }
}
```

### Performance Monitoring

```typescript
// Monitor key metrics
@Injectable()
export class KafkaMonitoringService {
  private metrics = {
    messagesProduced: 0,
    messagesConsumed: 0,
    errors: 0,
    avgProcessingTime: 0,
  };

  @Cron('0 * * * * *') // Every minute
  reportMetrics() {
    this.logger.log('Kafka Metrics', this.metrics);
    
    // Alert on anomalies
    if (this.metrics.errors > 100) {
      this.alertHighErrorRate();
    }
    
    if (this.metrics.avgProcessingTime > 5000) {
      this.alertSlowProcessing();
    }
  }
}
```

## Common Error Messages and Solutions

### "Broker may not be available"
- **Cause**: Network connectivity issues or broker down
- **Solution**: Check broker status and network connectivity

### "Request timed out"
- **Cause**: Network latency or broker overload
- **Solution**: Increase `requestTimeout` and check broker performance

### "Topic does not exist"
- **Cause**: Topic not created or wrong topic name
- **Solution**: Create topic or verify topic name

### "Not authorized to access topic"
- **Cause**: Insufficient permissions
- **Solution**: Check Kafka ACLs and user permissions

### "Consumer group rebalancing"
- **Cause**: Consumer instances joining/leaving group
- **Solution**: Normal behavior, but frequent rebalancing indicates issues

### "Offset out of range"
- **Cause**: Trying to read from invalid offset
- **Solution**: Reset consumer group offset or use `fromBeginning: true`

## Getting Help

### Collect Diagnostic Information

```bash
# Check Kafka cluster status
kafka-topics.sh --list --bootstrap-server localhost:9092

# Check consumer group status
kafka-consumer-groups.sh --describe --group my-group --bootstrap-server localhost:9092

# Check topic details
kafka-topics.sh --describe --topic my-topic --bootstrap-server localhost:9092
```

### Enable Detailed Logging

```typescript
// Temporary debug configuration
KafkaModule.forRoot({
  logLevel: 'debug',
  // ... other config
})
```

### Create Minimal Reproduction

```typescript
// Simple test to isolate issues
@Controller('test')
export class KafkaTestController {
  constructor(private kafkaClient: KafkaClient) {}

  @Post('send')
  async testSend() {
    await this.kafkaClient.send('test-topic', {
      key: 'test-key',
      value: JSON.stringify({ message: 'test' }),
    });
    return { status: 'sent' };
  }
}

@Consumer('test-topic')
export class TestConsumer {
  async handleMessage(message: KafkaMessage) {
    console.log('Received test message:', message.value.toString());
  }
}
```

## Next Steps

- [Review Best Practices](./best-practices)
- [Check Configuration](./configuration)
- [Back to Overview](./)