---
sidebar_position: 4
sidebar_label: Errors & Logging
---
# Errors Handling and Logging


Robust error handling is integral to workflows and state machines. In the context of NestJS Workflow, the service provides a built-in fallback mechanism to manage errors during state transitions. This mechanism is defined in the workflow definition as a `Fallback` function:

```typescript
Fallback?: (entity: T, event: Event, payload?: P | T | object | string) => Promise<T>;
```


This function is invoked when an error occurs during a transition, allowing developers to define custom logic for handling such scenarios.

### **Implementing the Fallback Mechanism**

To utilize the fallback mechanism, define it within your workflow definition:

```typescript
export const prescriptionWorkflowDefinition: WorkflowDefinition<
  PrescriptionOrder,
  any,
  PrescriptionEvent,
  PrescriptionStatus
> = {
  // ... other definitions
  Fallback: async (entity, event, payload) => {
    // Custom error handling logic
    await kafkaService.produce('workflow.failed', {
      urn: entity.urn,
      entityType: 'PrescriptionOrder',
      currentState: entity.status,
      event,
      payload,
      timestamp: new Date(),
    });
    // Optionally, update the entity's status to a failed state
    entity.status = PrescriptionStatus.Failed;
    return entity;
  },
};
```


In this example, when an error occurs during a transition, the fallback function sends an event to a Kafka topic (`workflow.failed`) with relevant details and updates the entity's status to `Failed`.

---

## **Logging and Error Controls**

The NestJS Workflow service incorporates logging to monitor state transitions and errors. By default, it uses NestJS's built-in `Logger` service to log significant events, such as the initialization of actions and transitions.

Transtions and states are logged using the URN or ID as the identifier to be used like a correlation-id. Also a correlation id mechanism can be used to track the flow of a request through the workflow.

Also a detailed log of transitions and errors can be maintained by adding custom logging within the workflow definition or using NestJS's logging decorators. For instance, you can log the start and end of transitions, the entity's state, and any errors encountered during the process.


These logs provide insights into the workflow's configuration and runtime behavior. For enhanced logging capabilities, developers can integrate custom logging services or third-party monitoring tools.

---

## **Integration with Monitoring Tools**

Integrating a log ingestion or monitoring tool with your workflow system offers several advantages:

- **Comprehensive Visibility:** Monitor all stages and transitions of your business processes in real-time.

- **Proactive Error Detection:** Identify and address issues promptly before they escalate.

- **Performance Analysis:** Analyze the performance of workflows to optimize processes and resource utilization.

For instance, integrating with tools like [AppSignal](https://blog.appsignal.com/2023/02/22/track-errors-in-your-nestjs-application-with-appsignal.html) can provide application performance monitoring, error tracking, and anomaly detection, enhancing the observability of your NestJS application.

---

## **Benefits of AI-Powered Tools**

Incorporating AI-powered tools into your workflow and monitoring systems can further enhance operational efficiency:

- **Automated Insights:** AI can analyze vast amounts of data to provide actionable insights, helping in decision-making processes.

- **Predictive Analytics:** Anticipate potential issues or bottlenecks in workflows before they occur, allowing for proactive measures.

- **Enhanced User Experience:** AI-driven tools can personalize interactions and streamline processes, improving overall user satisfaction.

While specific tools like [Whawit.ai](https://app.whawit.ai) are not widely recognized, the general benefits of AI in workflow management and monitoring are substantial. AI can automate routine tasks, provide predictive insights, and enhance the adaptability of systems to changing conditions.

---
