---
sidebar_position: 1
sidebar_label: Quickstart
--- 

# Quickstart   
## Implementing Order Processing with NestJS Workflow

This guide will walk you through setting up the NestJS Workflow module to manage the state transitions of an order processing system.

## Prerequisites

- A NestJS application set up with TypeScript.
- Node.js and npm installed.

## Step 1: Install the NestJS Workflow Module

Install the module using npm:

```bash
npm install @jescrich/nestjs-workflow
```


Or with yarn:

```bash
yarn add @jescrich/nestjs-workflow
```

## Step 2: Define the Order Entity and Enums

Create the `Order` entity along with enums for order events and statuses:

```typescript
// order.model.ts

export enum OrderEvent {
  Create = 'order.create',
  Submit = 'order.submit',
  Update = 'order.update',
  Complete = 'order.complete',
  Fail = 'order.fail',
  Cancel = 'order.cancel',
}

export enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export class Order {
  urn: string;
  name: string;
  price: number;
  items: string[];
  status: OrderStatus;
}
```

## Step 3: Define the Workflow

Create a workflow definition that outlines the states and transitions for the order:

```typescript
// order.workflow.ts

import { WorkflowDefinition } from '@jescrich/nestjs-workflow';
import { Order, OrderEvent, OrderStatus } from './order.model';

export const orderWorkflowDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
  FinalStates: [OrderStatus.Completed, OrderStatus.Failed],
  IdleStates: [OrderStatus.Pending, OrderStatus.Processing, OrderStatus.Completed, OrderStatus.Failed],
  Transitions: [
    {
      from: OrderStatus.Pending,
      to: OrderStatus.Processing,
      event: OrderEvent.Submit,
      conditions: [(entity: Order) => entity.price > 10],
    },
    {
      from: OrderStatus.Pending,
      to: OrderStatus.Pending,
      event: OrderEvent.Update,
      actions: [
        (entity: Order, payload: any) => {
          entity.price = payload.price;
          entity.items = payload.items;
          return Promise.resolve(entity);
        },
      ],
    },
    {
      from: OrderStatus.Processing,
      to: OrderStatus.Completed,
      event: OrderEvent.Complete,
    },
    {
      from: OrderStatus.Processing,
      to: OrderStatus.Failed,
      event: OrderEvent.Fail,
    },
  ],
  FailedState: OrderStatus.Failed,
  Entity: {
    new: () => new Order(),
    update: async (entity: Order, status: OrderStatus) => {
      entity.status = status;
      return entity;
    },
    load: async (urn: string) => {
      // Implement logic to load the order entity by URN
      return new Order(); // Placeholder implementation
    },
    status: (entity: Order) => entity.status,
    urn: (entity: Order) => entity.urn,
  },
};
```

## Step 4: Register the Workflow Module

Import and register the `WorkflowModule` in your NestJS application module:

```typescript
// app.module.ts

import { Module } from '@nestjs/common';
import { WorkflowModule } from '@jescrich/nestjs-workflow';
import { orderWorkflowDefinition } from './order.workflow';

@Module({
  imports: [
    WorkflowModule.register({
      name: 'orderWorkflow',
      definition: orderWorkflowDefinition,
    }),
    WorkflowModule.forRoot({
      storage: {
        type: 'memory', // For production, consider using 'database'
      },
    }),
  ],
})
export class AppModule {}
```

## Step 5: Utilize the Workflow in a Service

Inject the workflow into your service and define methods to handle order events:

```typescript
// order.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { Workflow } from '@jescrich/nestjs-workflow';
import { Order, OrderEvent } from './order.model';

@Injectable()
export class OrderService {
  constructor(
    @Inject('orderWorkflow')
    private readonly orderWorkflow: Workflow<Order, OrderEvent>,
  ) {}

  async submitOrder(urn: string) {
    return await this.orderWorkflow.emit({ urn, event: OrderEvent.Submit });
  }

  async updateOrder(urn: string, price: number, items: string[]) {
    return await this.orderWorkflow.emit({
      urn,
      event: OrderEvent.Update,
      payload: { price, items },
    });
  }
}
```

## Step 6: Implement Class-Based Actions with Decorators

For more complex workflows, you can define actions using decorators:

```typescript
// order.actions.ts

import { Injectable } from '@nestjs/common';
import { WorkflowAction, OnEvent, OnStatusChanged } from '@jescrich/nestjs-workflow';
import { Order, OrderEvent, OrderStatus } from './order.model';

@Injectable()
@WorkflowAction()
export class OrderActions {
  @OnEvent({ event: OrderEvent.Submit })
  execute({ entity, payload }: { entity: Order; payload: any }) {
    entity.price *= 100;
    return Promise.resolve(entity);
  }

  @OnStatusChanged({ from: OrderStatus.Pending, to: OrderStatus.Processing })
  onProcessing({ entity }: { entity: Order }) {
    entity.name = 'Processing Order';
    return Promise.resolve(entity);
  }
}
```


Ensure to register these action classes as providers in your module:

```typescript
// app.module.ts

import { Module } from '@nestjs/common';
import { WorkflowModule } from '@jescrich/nestjs-workflow';
import { orderWorkflowDefinition } from './order.workflow';
import { OrderActions } from './order.actions';

@Module({
  imports: [
    WorkflowModule.register({
      name: 'orderWorkflow',
      definition: orderWorkflowDefinition,
    }),
    WorkflowModule.forRoot({
      storage: {
        type: 'memory',
      },
    }),
  ],
  providers: [OrderActions],
})
export class AppModule {}
```

## Conclusion

By following these steps, you've set up the NestJS Workflow module to manage the state transitions of an order processing system. This structured approach enhances code maintainability and aligns with best practices for enterprise application development.
