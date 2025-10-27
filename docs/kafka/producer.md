---
sidebar_position: 4
---
---
title: Kafka Producer - High-Performance Message Publishing
description: Learn to use the NestJS Kafka producer with intelligent connection management, batch operations, transactions, and front pressure handling for enterprise applications.
keywords: [Kafka Producer, NestJS Producer, Message Publishing, Batch Operations, Transactions, Front Pressure, Circuit Breaker]
---

# Kafka Producer

The KafkaClient provides high-performance message production with intelligent connection management and automatic batching capabilities.

## Basic Usage

### Inject the KafkaClient

```typescript
import { Injectable } from '@nestjs/common';
import { KafkaClient } from '@jescrich/nestjs-kafka-client';

@Injectable()
export class OrderService {
  constructor(private readonly kafkaClient: KafkaClient) {}
}
```

### Send Single Messages

```typescript
async createOrder(order: Order) {
  await this.kafkaClient.send('orders', {
    key: order.customerId, // Messages with same key are processed in order
    value: JSON.stringify(order),
    headers: {
      'idempotency-key': order.id, // Prevents duplicate processing
      'content-type': 'application/json',
    },
  });
}
```

### Send with Partitioning

```typescript
async createOrderWithPartition(order: Order) {
  await this.kafkaClient.send('orders', {
    key: order.customerId,
    value: JSON.stringify(order),
    partition: this.getPartitionForCustomer(order.customerId),
  });
}

private getPartitionForCustomer(customerId: string): number {
  // Simple hash-based partitioning
  return Math.abs(customerId.hashCode()) % 3;
}
```

## Batch Operations

### Send Multiple Messages

```typescript
async createMultipleOrders(orders: Order[]) {
  await this.kafkaClient.sendBatch('orders', 
    orders.map(order => ({
      key: order.customerId,
      value: JSON.stringify(order),
      headers: {
        'idempotency-key': order.id,
        'timestamp': new Date().toISOString(),
      },
    }))
  );
}
```

### Send to Multiple Topics

```typescript
async processOrderWorkflow(order: Order) {
  const messages = [
    {
      topic: 'orders',
      messages: [{
        key: order.customerId,
        value: JSON.stringify(order),
      }],
    },
    {
      topic: 'inventory',
      messages: [{
        key: order.productId,
        value: JSON.stringify({ 
          productId: order.productId, 
          quantity: order.quantity 
        }),
      }],
    },
    {
      topic: 'notifications',
      messages: [{
        key: order.customerId,
        value: JSON.stringify({
          customerId: order.customerId,
          type: 'order_created',
          orderId: order.id,
        }),
      }],
    },
  ];

  await this.kafkaClient.sendBatch(messages);
}
```

## Advanced Producer Features

### Transactional Messages

```typescript
async processPayment(payment: Payment) {
  const transaction = await this.kafkaClient.transaction();
  
  try {
    await transaction.send('payments', {
      key: payment.orderId,
      value: JSON.stringify(payment),
    });
    
    await transaction.send('orders', {
      key: payment.orderId,
      value: JSON.stringify({ 
        orderId: payment.orderId, 
        status: 'paid' 
      }),
    });
    
    await transaction.commit();
  } catch (error) {
    await transaction.abort();
    throw error;
  }
}
```

### Custom Serialization

```typescript
import { Serializer } from '@jescrich/nestjs-kafka-client';

@Injectable()
export class AvroOrderService {
  constructor(
    private readonly kafkaClient: KafkaClient,
    private readonly avroSerializer: Serializer,
  ) {}

  async createOrder(order: Order) {
    const serializedValue = await this.avroSerializer.serialize(
      'order-schema',
      order
    );

    await this.kafkaClient.send('orders', {
      key: order.customerId,
      value: serializedValue,
      headers: {
        'content-type': 'application/avro',
      },
    });
  }
}
```

### Error Handling and Retries

```typescript
async createOrderWithRetry(order: Order) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await this.kafkaClient.send('orders', {
        key: order.customerId,
        value: JSON.stringify(order),
        headers: {
          'retry-attempt': attempt.toString(),
        },
      });
      return; // Success
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) {
        // Send to DLQ or handle failure
        await this.handleFailedOrder(order, error);
        throw error;
      }
      
      // Exponential backoff
      await this.delay(Math.pow(2, attempt) * 1000);
    }
  }
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Performance Optimization

### Connection Pooling

The KafkaClient automatically manages connection pooling, but you can configure it:

```typescript
// In your module configuration
KafkaModule.forRoot({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
  
  // Producer-specific settings
  producer: {
    maxInFlightRequests: 5,
    idempotent: true,
    transactionTimeout: 30000,
  },
})
```

### Compression

Enable compression for better throughput:

```typescript
await this.kafkaClient.send('large-messages', {
  key: 'key',
  value: largeJsonPayload,
}, {
  compression: 'gzip', // or 'snappy', 'lz4'
});
```

### Monitoring Production

```typescript
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  async createOrder(order: Order) {
    const startTime = Date.now();
    
    try {
      await this.kafkaClient.send('orders', {
        key: order.customerId,
        value: JSON.stringify(order),
      });
      
      const duration = Date.now() - startTime;
      this.logger.log(`Order sent successfully in ${duration}ms`);
    } catch (error) {
      this.logger.error(`Failed to send order: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

## Best Practices

1. **Use meaningful keys** for proper partitioning and ordering
2. **Include idempotency keys** in headers for critical messages
3. **Batch related messages** for better throughput
4. **Handle errors gracefully** with proper retry logic
5. **Monitor producer metrics** for performance optimization
6. **Use transactions** for multi-topic atomic operations

## Next Steps

- [Learn about Kafka Consumers](./consumer)
- [Explore Advanced Features](./advanced-features)
- [Review Configuration Options](./configuration)