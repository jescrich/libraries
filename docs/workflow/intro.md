---
sidebar_position: 2
sidebar_label: Introduction
---
# NestJS Workflow & State Machine

  ## Overview
  A powerful, intuitive workflow management tool built specifically for NestJS and Node.js applications. This library allows you to define, manage, and execute workflows using a straightforward, declarative syntax, transforming complex state transitions into structured, maintainable code.

  Instead of writing intricate conditional logic scattered across your application, NestJS Workflow provides a centralized approach to workflow management, leading to clearer code, better governance, and improved maintainability.

  ## Installation
  ```bash
  npm install @jescrich/nestjs-workflow
  ```

  or using Yarn:
  ```bash
  yarn add @jescrich/nestjs-workflow
  ```

  ## Usage

  ### Module Registration
  ```typescript
  import { Module } from '@nestjs/common';
  import { WorkflowModule } from '@jescrich/nestjs-workflow';

  @Module({
    imports: [
      WorkflowModule.register({
        name: 'orderWorkflow',
        definition: orderWorkflowDefinition,
      }),
      WorkflowModule.forRoot({ storage: { type: 'memory' } }),
    ],
  })
  export class AppModule {}
  ```
  *app.module.ts*

  ### Define a Workflow
  ```typescript
  import { WorkflowDefinition } from '@jescrich/nestjs-workflow';
  import { Order, OrderEvent, OrderStatus } from '../orders/types';

  const orderWorkflowDefinition: WorkflowDefinition<Order, any, OrderEvent, OrderStatus> = {
    FinalStates: [OrderStatus.Completed, OrderStatus.Failed],
    Transitions: [
      {
        from: OrderStatus.Pending,
        to: OrderStatus.Processing,
        event: OrderEvent.Submit,
        conditions: [(entity) => entity.price > 10],
      },
      {
        from: OrderStatus.Pending,
        to: OrderStatus.Pending,
        event: OrderEvent.Update,
        actions: [(entity, payload) => {
          entity.price = payload.price;
          entity.items = payload.items;
          return Promise.resolve(entity);
        }],
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
  };

  export default orderWorkflowDefinition;
  ```
  *order.workflow.ts*

  ### Using Workflows in Services
  ```typescript
  import { Injectable, Inject } from '@nestjs/common';
  import { Workflow } from '@jescrich/nestjs-workflow';
  import { Order, OrderEvent } from './types';

  @Injectable()
  export class OrderService {
    constructor(
      @Inject('orderWorkflow') private readonly workflow: Workflow<Order, OrderEvent>,
    ) {}

    async submitOrder(urn: string) {
      return await this.workflow.emit({ urn, event: OrderEvent.Submit });
    }

    async updateOrder(urn: string, price: number, items: string[]) {
      return await this.workflow.emit({
        urn,
        event: OrderEvent.Update,
        payload: { price, items },
      });
    }
  }
  ```
  *orders.service.ts*

  ### Class-based Actions with Decorators
  ```typescript
  import { Injectable } from '@nestjs/common';
  import { WorkflowAction, OnEvent, OnStatusChanged } from '@jescrich/nestjs-workflow';
  import { Order, OrderEvent, OrderStatus } from '../orders/types';

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
  *order.actions.ts*

  ## Benefits

  ### Maintainability
  Workflow definitions centralize state logic, making it easy to update or extend. This reduces the cognitive load on developers and simplifies debugging.

  ### Architecture Governance
  NestJS Workflow enforces clear and consistent state management practices. Developers adhere to a structured approach, aligning code with enterprise architecture standards.

  ### Scalability & Extensibility
  The workflow engine integrates seamlessly into NestJS applications, enabling easy extension through custom actions, conditions, and event handlers.

  ### Event-Driven & Declarative
  Built on NestJS's event system, the workflow module enables clear and robust event-driven architectures that are easier to reason about and document.

  ## API Reference

  ### WorkflowModule
  ```typescript
  // Register a specific workflow
  WorkflowModule.register({
    name: string,
    definition: WorkflowDefinition<Entity, Payload, Event, Status>
  })

  // Configure the workflow module globally
  WorkflowModule.forRoot({
    storage: { type: 'memory' | 'database' }
  })
  ```

  ### WorkflowDefinition
  ```typescript
  interface WorkflowDefinition<Entity, Payload, Event, Status> {
    FinalStates: Status[];
    Transitions: Array<{
      from: Status;
      to: Status;
      event: Event;
      conditions?: Array<(entity: Entity) => boolean>;
      actions?: Array<(entity: Entity, payload?: Payload) => Promise<Entity>>;
    }>;
  }
  ```

  ### Workflow Service
  ```typescript
  // Emit an event to trigger a workflow transition
  workflow.emit({
    urn: string,
    event: Event,
    payload?: any
  }): Promise<Entity>
  ```

  ### Decorators
  - `@WorkflowAction()` - Mark a class as containing workflow action handlers
  - `@OnEvent({ event })` - Define an event handler method
  - `@OnStatusChanged({ from, to })` - Define a status transition handler method

  ## From Chaos to Clarity
  By adopting NestJS Workflow, you transform complex, error-prone state transitions into structured, clear, and maintainable workflows. This architectural clarity improves team efficiency, reduces bugs, and makes scaling enterprise applications much smoother.

  ## Repository
  Explore NestJS Workflow & State Machine: https://github.com/jescrich/nestjs-workflow

  ## License
  This project is licensed under the MIT License.