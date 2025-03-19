---
sidebar_position: 4
sidebar_label: Kafka Integration
--- 
# Implementing Kafka Integration with NestJS Workflow

This documentation explains how to integrate Apache Kafka with the NestJS Workflow engine to create event-driven workflows that respond to Kafka messages.

## Prerequisites
- A running NestJS application
- Basic understanding of workflow concepts
- Access to a Kafka broker

## Installation
First, install the NestJS Workflow package:

```bash
npm install @jescrich/nestjs-workflow
```

You'll also need the Kafka client libraries:

```bash
npm install kafkajs
```

## Basic Kafka Integration

### Step 1: Configure Kafka in Your Workflow Definition
Add a Kafka property to your workflow definition that specifies:
- Kafka broker addresses
- Topic-to-event mappings

```typescript
import { WorkflowDefinition } from '@jescrich/nestjs-workflow';
import { Order, OrderEvent, OrderStatus } from '../models/order.model';

export const orderWorkflowDefinition = (entity: Order): WorkflowDefinition<Order, any, OrderEvent, OrderStatus> => {
  return {
    // Standard workflow configuration
    FinalStates: [OrderStatus.Completed, OrderStatus.Failed],
    IdleStates: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
    Transitions: [
      // Your transitions here
    ],
    FailedState: OrderStatus.Failed,
    
    // Kafka configuration
    Kafka: {
      brokers: 'localhost:9092', // Comma-separated list for multiple brokers
      events: [
        { topic: 'orders.submitted', event: OrderEvent.Submit },
        { topic: 'orders.completed', event: OrderEvent.Complete },
        { topic: 'orders.failed', event: OrderEvent.Fail }
      ]
    },
    
    Entity: {
      // Entity configuration
      new: () => new Order(),
      update: async (entity: Order, status: OrderStatus) => {
        entity.status = status;
        return entity;
      },
      load: async (urn: string) => {
        // Load entity from your database
        return yourRepository.findByUrn(urn);
      },
      status: (entity: Order) => entity.status,
      urn: (entity: Order) => entity.urn
    }
  };
};
```

*order-workflow.definition.ts*

### Step 2: Register the Workflow Module
Register your workflow with the Kafka configuration in your module:

```typescript
import { Module } from '@nestjs/common';
import { WorkflowModule } from '@jescrich/nestjs-workflow';
import { orderWorkflowDefinition } from '../workflows/order-workflow.definition';
import { OrderRepository } from '../repositories/order.repository';
import { OrderService } from '../services/order.service';

@Module({
  imports: [
    WorkflowModule.register({
      name: 'orderWorkflow',
      definition: orderWorkflowDefinition,
    }),
  ],
  providers: [OrderRepository, OrderService],
  exports: [OrderService],
})
export class OrderModule {}
```

*order.module.ts*

## Message Format Requirements
For the workflow engine to process Kafka messages correctly, your messages must include:
- An entity URN to identify which entity the message applies to
- Any additional payload data needed for workflow processing

Example Kafka message format:

```json
{
  "urn": "urn:order:123",
  "price": 150,
  "items": ["Item 1", "Item 2"]
}
```

## Advanced Kafka Configuration
For more advanced Kafka configurations, you can provide additional options:

```typescript
Kafka: {
  brokers: 'kafka-broker-1:9092,kafka-broker-2:9092',
  clientId: 'order-workflow-service',
  groupId: 'order-workflow-consumers',
  ssl: true,
  sasl: {
    mechanism: 'plain',
    username: 'your-username',
    password: 'your-password'
  },
  events: [
    { topic: 'orders.submitted', event: OrderEvent.Submit },
    { topic: 'orders.completed', event: OrderEvent.Complete },
    { topic: 'orders.failed', event: OrderEvent.Fail }
  ]
}
```

*order-workflow.definition.ts*

## Publishing Events to Kafka

```typescript
import { Injectable } from '@nestjs/common';
import { WorkflowService } from '@jescrich/nestjs-workflow';
import { Order, OrderEvent, OrderStatus } from '../models/order.model';
import { Kafka } from 'kafkajs';

@Injectable()
export class OrderService {
  private kafka: Kafka;
  private producer;

  constructor(
    private readonly workflowService: WorkflowService<Order, any, OrderEvent, OrderStatus>,
  ) {
    // Initialize Kafka producer
    this.kafka = new Kafka({
      clientId: 'order-service',
      brokers: ['localhost:9092'],
    });
    this.producer = this.kafka.producer();
    this.producer.connect();
  }

  async submitOrder(orderId: string) {
    // Publish to Kafka
    await this.producer.send({
      topic: 'orders.submitted',
      messages: [
        { 
          value: JSON.stringify({
            urn: `urn:order:${orderId}`,
            timestamp: new Date().toISOString()
          }) 
        },
      ],
    });
    
    // The workflow will automatically process this event when it receives it from Kafka
    return { success: true, message: 'Order submission event published' };
  }
}
```

*order.service.ts*

## Error Handling
When integrating with Kafka, implement proper error handling:

```typescript
// In your workflow definition
Transitions: [
  {
    from: OrderStatus.Processing,
    to: OrderStatus.Failed,
    event: OrderEvent.Fail,
    actions: [
      async (entity: Order, payload: any) => {
        // Log the failure
        console.error(`Order ${entity.urn} failed processing`, payload);
        
        // You could also publish to a dead letter queue
        await kafkaProducer.send({
          topic: 'orders.deadletter',
          messages: [{ value: JSON.stringify({ urn: entity.urn, error: payload.error }) }],
        });
        
        return entity;
      }
    ]
  }
]
```

*order-workflow.definition.ts*

## Testing Kafka Integration
For testing, you can use an in-memory Kafka implementation or mock the Kafka client:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowModule } from '@jescrich/nestjs-workflow';
import { orderWorkflowDefinition } from '../workflows/order-workflow.definition';

// Mock Kafka client
jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => {
      return {
        consumer: jest.fn().mockReturnValue({
          connect: jest.fn(),
          subscribe: jest.fn(),
          run: jest.fn(),
          disconnect: jest.fn(),
        }),
      };
    }),
  };
});

describe('Order Workflow with Kafka', () => {
  let app;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        WorkflowModule.register({
          name: 'orderWorkflow',
          definition: orderWorkflowDefinition,
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should process Kafka messages correctly', async () => {
    // Test implementation
  });
});
```

*order-workflow.spec.ts*

## Best Practices
- Consumer Groups: Use meaningful consumer group IDs to ensure proper message distribution
- Error Handling: Implement robust error handling for Kafka connection issues
- Message Validation: Validate incoming Kafka messages before processing
- Idempotency: Design your workflow to handle duplicate messages gracefully
- Monitoring: Set up monitoring for your Kafka consumers to track performance and errors

## Conclusion
By integrating Kafka with NestJS Workflow, you can create powerful event-driven workflows that respond to messages from your event streaming platform. This enables building scalable, loosely-coupled systems where workflow state transitions are triggered by events flowing through your Kafka topics.