---
sidebar_position: 3
---
---
title: Kafka Consumer - Enterprise Message Processing
description: Master NestJS Kafka consumers with batch processing, key-based grouping, backpressure management, idempotency, and automatic error handling with DLQ support.
keywords: [Kafka Consumer, NestJS Consumer, Batch Processing, Key Grouping, Backpressure, Idempotency, Dead Letter Queue, Message Processing]
---

# Kafka Consumer

The Consumer decorator provides enterprise-grade message consumption with advanced batch processing, key-based grouping, and automatic pressure management.

## Basic Consumer

### Simple Message Consumer

```typescript
import { Consumer } from '@jescrich/nestjs-kafka-client';
import { Injectable } from '@nestjs/common';

@Injectable()
@Consumer('orders')
export class OrderConsumer {
  async handleMessage(message: KafkaMessage) {
    const order = JSON.parse(message.value.toString());
    console.log('Processing order:', order);
    
    // Process the order
    await this.processOrder(order);
    
    // Automatic commit after successful processing
    // Built-in error handling with DLQ support
  }

  private async processOrder(order: any) {
    // Your business logic here
  }
}
```

### Consumer with Error Handling

```typescript
@Consumer('payments', {
  dlq: {
    topic: 'payments-dlq',
    maxRetries: 3,
    retryDelay: 1000, // 1 second between retries
  }
})
export class PaymentConsumer {
  private readonly logger = new Logger(PaymentConsumer.name);

  async handleMessage(message: KafkaMessage) {
    try {
      const payment = JSON.parse(message.value.toString());
      await this.processPayment(payment);
      this.logger.log(`Payment processed: ${payment.id}`);
    } catch (error) {
      this.logger.error(`Payment processing failed: ${error.message}`);
      throw error; // Will trigger retry logic
    }
  }
}
```

## Batch Processing

### Basic Batch Consumer

```typescript
@Consumer('orders', {
  batch: true,
  batchSize: 100,
  batchTimeout: 5000, // Process batch every 5 seconds or when full
})
export class OrderBatchConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    const orders = messages.map(msg => 
      JSON.parse(msg.value.toString())
    );
    
    // Process all orders in the batch
    await this.processBatchOrders(orders);
  }

  private async processBatchOrders(orders: any[]) {
    // Efficient batch processing
    await Promise.all(orders.map(order => this.processOrder(order)));
  }
}
```

### Batch Consumer with Key Grouping

```typescript
@Consumer('orders', {
  batch: true,
  batchSize: 100,
  batchTimeout: 5000,
  groupByKey: true, // Group messages by key within batch
})
export class OrderBatchConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Messages are automatically grouped by key
    // All messages for customer 'A' will be in sequence
    const ordersByCustomer = this.groupByCustomer(messages);
    
    // Process each customer's orders in parallel
    await Promise.all(
      Object.entries(ordersByCustomer).map(([customerId, orders]) =>
        this.processCustomerOrders(customerId, orders)
      )
    );
  }

  private groupByCustomer(messages: KafkaMessage[]) {
    return messages.reduce((acc, msg) => {
      const customerId = msg.key?.toString();
      if (!acc[customerId]) acc[customerId] = [];
      acc[customerId].push(JSON.parse(msg.value.toString()));
      return acc;
    }, {} as Record<string, any[]>);
  }

  private async processCustomerOrders(customerId: string, orders: any[]) {
    // Process orders for a specific customer in sequence
    for (const order of orders) {
      await this.processOrder(order);
    }
  }
}
```

## Advanced Consumer Features

### High-Volume Consumer with Pressure Management

```typescript
@Consumer('high-volume-topic', {
  batch: true,
  batchSize: 500,
  maxConcurrency: 10,        // Limit concurrent batch processing
  backPressureThreshold: 80, // Pause consumption at 80% capacity
  idempotencyKey: (msg) => msg.headers['idempotency-key'], // Custom idempotency
})
export class HighVolumeConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Automatic back pressure management
    // If processing falls behind, consumption will pause
    // Front pressure is managed through intelligent buffering
    
    await this.processMessages(messages);
  }

  private async processMessages(messages: KafkaMessage[]) {
    // Your high-volume processing logic
    const chunks = this.chunkArray(messages, 50);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(msg => this.processMessage(msg))
      );
    }
  }
}
```

### Consumer with Custom Deserialization

```typescript
@Consumer('avro-orders', {
  deserializer: 'avro',
})
export class AvroOrderConsumer {
  constructor(private readonly avroDeserializer: Deserializer) {}

  async handleMessage(message: KafkaMessage) {
    // Automatic deserialization based on schema
    const order = await this.avroDeserializer.deserialize(
      'order-schema',
      message.value
    );
    
    await this.processOrder(order);
  }
}
```

### Idempotent Consumer

```typescript
@Consumer('payments', {
  idempotencyKey: (message) => message.headers['transaction-id'],
  idempotencyTtl: 3600000, // 1 hour
})
export class PaymentConsumer {
  async handleMessage(message: KafkaMessage) {
    // This message will only be processed once per transaction-id
    // Duplicates are automatically filtered out
    
    const payment = JSON.parse(message.value.toString());
    await this.processPayment(payment);
  }
}
```

## Consumer Configuration Options

### Complete Configuration Example

```typescript
@Consumer('complex-topic', {
  // Batch processing
  batch: true,
  batchSize: 200,
  batchTimeout: 10000,
  
  // Key grouping and ordering
  groupByKey: true,
  
  // Pressure management
  maxConcurrency: 5,
  backPressureThreshold: 80,
  
  // Idempotency
  idempotencyKey: (msg) => msg.headers['id'],
  idempotencyTtl: 3600000,
  
  // Error handling
  dlq: {
    topic: 'complex-topic-dlq',
    maxRetries: 3,
    retryDelay: 1000,
  },
  
  // Consumer group settings
  groupId: 'complex-consumer-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  
  // Offset management
  fromBeginning: false,
  autoCommit: true,
  autoCommitInterval: 5000,
})
export class ComplexConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    // Your processing logic
  }
}
```

## Message Processing Patterns

### Sequential Processing

```typescript
@Consumer('sequential-orders')
export class SequentialOrderConsumer {
  async handleMessage(message: KafkaMessage) {
    const order = JSON.parse(message.value.toString());
    
    // Process steps in sequence
    await this.validateOrder(order);
    await this.reserveInventory(order);
    await this.processPayment(order);
    await this.fulfillOrder(order);
  }
}
```

### Parallel Processing with Coordination

```typescript
@Consumer('parallel-orders', {
  batch: true,
  batchSize: 50,
})
export class ParallelOrderConsumer {
  async handleBatch(messages: KafkaMessage[]) {
    const orders = messages.map(msg => JSON.parse(msg.value.toString()));
    
    // Process validation in parallel
    await Promise.all(orders.map(order => this.validateOrder(order)));
    
    // Process payments in parallel
    await Promise.all(orders.map(order => this.processPayment(order)));
    
    // Fulfill orders sequentially (if order matters)
    for (const order of orders) {
      await this.fulfillOrder(order);
    }
  }
}
```

### Conditional Processing

```typescript
@Consumer('mixed-events')
export class EventConsumer {
  async handleMessage(message: KafkaMessage) {
    const event = JSON.parse(message.value.toString());
    
    switch (event.type) {
      case 'order_created':
        await this.handleOrderCreated(event);
        break;
      case 'payment_processed':
        await this.handlePaymentProcessed(event);
        break;
      case 'order_shipped':
        await this.handleOrderShipped(event);
        break;
      default:
        console.log(`Unknown event type: ${event.type}`);
    }
  }
}
```

## Monitoring and Observability

### Consumer with Metrics

```typescript
@Consumer('monitored-topic')
export class MonitoredConsumer {
  private readonly logger = new Logger(MonitoredConsumer.name);
  private processedCount = 0;
  private errorCount = 0;

  async handleMessage(message: KafkaMessage) {
    const startTime = Date.now();
    
    try {
      await this.processMessage(message);
      this.processedCount++;
      
      const duration = Date.now() - startTime;
      this.logger.log(`Message processed in ${duration}ms`);
    } catch (error) {
      this.errorCount++;
      this.logger.error(`Processing failed: ${error.message}`);
      throw error;
    }
  }

  @Cron('0 * * * * *') // Every minute
  logMetrics() {
    this.logger.log(`Processed: ${this.processedCount}, Errors: ${this.errorCount}`);
  }
}
```

## Best Practices

1. **Use batch processing** for high-throughput scenarios
2. **Enable key grouping** when message order matters within a key
3. **Configure appropriate batch sizes** based on your processing capacity
4. **Implement idempotency** for critical business operations
5. **Set up DLQ** for proper error handling
6. **Monitor consumer lag** and processing metrics
7. **Use back pressure** to prevent system overload
8. **Handle errors gracefully** with proper logging

## Next Steps

- [Explore Advanced Features](./advanced-features)
- [Review Configuration Options](./configuration)
- [Learn Best Practices](./best-practices)