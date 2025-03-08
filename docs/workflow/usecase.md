---
sidebar_position: 4
sidebar_label: Use Case
---

# Use Case
## Medical Prescription Order Workflow with NestJS Workflow & Kafka Integration

## Scenario Description
In a healthcare management system, managing prescription orders efficiently is crucial. Each prescription order moves through different statuses from initiation to completion. The application must reliably handle status transitions, trigger specific actions during transitions, communicate with external systems (such as pharmacies and insurance providers), and integrate event-driven architecture through Kafka.

---

## Prescription Order States & Events

### States
```typescript
export enum PrescriptionStatus {
  Requested = 'requested',        // Initial state when prescription is created
  Approved = 'approved',          // Doctor has approved the prescription
  Rejected = 'rejected',          // Doctor rejected the prescription
  Processing = 'processing',      // Pharmacy is processing the prescription
  Dispensed = 'dispensed',        // Medication has been dispensed
  Completed = 'completed',        // Patient received medication
  Failed = 'failed'               // An issue occurred in dispensing
}
```

### Events
```typescript
export enum PrescriptionEvent {
  Request = 'prescription.request',
  Approve = 'prescription.approve',
  Reject = 'prescription.reject',
  Process = 'prescription.process',
  Dispense = 'prescription.dispense',
  Complete = 'prescription.complete',
  Fail = 'prescription.fail'
}
```

---

## Workflow Definition
```typescript
import { WorkflowDefinition } from '@jescrich/nestjs-workflow';

export const prescriptionWorkflowDefinition: WorkflowDefinition<
  PrescriptionOrder,
  any,
  PrescriptionEvent,
  PrescriptionStatus
> = {
  FinalStates: [PrescriptionStatus.Completed, PrescriptionStatus.Rejected, PrescriptionStatus.Failed],
  IdleStates: Object.values(PrescriptionStatus),
  FailedState: PrescriptionStatus.Failed,
  
  Transitions: [
    {
      from: PrescriptionStatus.Requested,
      to: PrescriptionStatus.Approved,
      event: PrescriptionEvent.Approve,
    },
    {
      from: PrescriptionStatus.Requested,
      to: PrescriptionStatus.Rejected,
      event: PrescriptionEvent.Reject,
    },
    {
      from: PrescriptionStatus.Approved,
      to: PrescriptionStatus.Processing,
      event: PrescriptionEvent.Process,
    },
    {
      from: PrescriptionStatus.Processing,
      to: PrescriptionStatus.Dispensed,
      event: PrescriptionEvent.Dispense,
    },
    {
      from: PrescriptionStatus.Dispensed,
      to: PrescriptionStatus.Completed,
      event: PrescriptionEvent.Complete,
    },
    {
      from: PrescriptionStatus.Processing,
      to: PrescriptionStatus.Failed,
      event: PrescriptionEvent.Fail,
    },
  ],

  Entity: {
    new: () => new PrescriptionOrder(),
    update: async (entity, status) => {
      entity.status = status;
      // Persist the status update in DB
      await prescriptionRepository.save(entity);
      return entity;
    },
    load: async (urn: string) => {
      // Load entity from DB
      return await prescriptionRepository.findOne({ urn });
    },
    status: (entity) => entity.status,
    urn: (entity) => entity.urn,
  },
};
```

---

## Additional Actions upon Status Changes
Implement class-based actions to handle extra logic after transitions, like communicating with third-party services and producing Kafka events.

### Actions Class Definition
```typescript
import { Injectable } from '@nestjs/common';
import { WorkflowAction, OnEvent, OnStatusChanged } from '@jescrich/nestjs-workflow';
import { PrescriptionOrder, PrescriptionEvent, PrescriptionStatus } from './prescription.model';
import { KafkaProducerService } from './kafka-producer.service';
import { PharmacyIntegrationService } from './pharmacy-integration.service';

@Injectable()
@WorkflowAction()
export class PrescriptionActions {
  constructor(
    private readonly kafkaService: KafkaProducerService,
    private readonly pharmacyService: PharmacyIntegrationService,
  ) {}

  @OnEvent({ event: PrescriptionEvent.Approve })
  async notifyInsurance({ entity }: { entity: PrescriptionOrder }) {
    // Notify insurance provider upon prescription approval
    await thirdPartyInsuranceAPI.notifyApproval(entity);
    return entity;
  }

  @OnStatusChanged({ from: PrescriptionStatus.Approved, to: PrescriptionStatus.Processing })
  async sendToPharmacy({ entity }: { entity: PrescriptionOrder }) {
    // Send prescription details to pharmacy system
    await this.pharmacyService.sendPrescription(entity);
    return entity;
  }

  @OnStatusChanged({ from: PrescriptionStatus.Processing, to: PrescriptionStatus.Dispensed })
  async produceDispensedEvent({ entity }: { entity: PrescriptionOrder }) {
    // Produce Kafka event when prescription is dispensed
    await this.kafkaService.produce('prescription.dispensed', {
      urn: entity.urn,
      patientId: entity.patientId,
      pharmacyId: entity.pharmacyId,
      timestamp: new Date(),
    });
    return entity;
  }

  @OnStatusChanged({ from: PrescriptionStatus.Dispensed, to: PrescriptionStatus.Completed })
  async completeOrder({ entity }: { entity: PrescriptionOrder }) {
    // Notify patient that prescription is completed
    await notificationService.notifyPatient(entity.patientId, 'Your prescription is ready for pickup.');
    return entity;
  }

  @OnStatusChanged({ from: PrescriptionStatus.Processing, to: PrescriptionStatus.Failed })
  async handleFailure({ entity }: { entity: PrescriptionOrder }) {
    // Alert the support team and produce Kafka event
    await alertingService.alertSupport('Prescription processing failed.', entity);
    await this.kafkaService.produce('prescription.failed', {
      urn: entity.urn,
      reason: 'Pharmacy processing error',
      timestamp: new Date(),
    });
    return entity;
  }
}
```

---

## Kafka Integration for Event Dispatching

### Kafka Consumer (Event Handler)
Handle external events (such as approvals from external doctors) via Kafka and emit corresponding workflow events:

```typescript
@Injectable()
export class PrescriptionKafkaConsumer {
  constructor(
    @Inject('prescriptionWorkflow')
    private readonly workflow: Workflow<PrescriptionOrder, PrescriptionEvent>,
  ) {}

  @KafkaListener('prescription.events')
  async handlePrescriptionEvents(message: KafkaMessage) {
    const { urn, event, payload } = message.value;
    await this.workflow.emit({ urn, event, payload });
  }
}
```

### Kafka Producer (On Status Change Events)
Produce Kafka events whenever a prescription order changes state:

```typescript
@Injectable()
export class KafkaProducerService {
  constructor(private readonly kafkaProducer: KafkaProducer) {}

  async produce(topic: string, data: Record<string, any>) {
    await this.kafkaProducer.send({
      topic,
      messages: [{ value: JSON.stringify(data) }],
    });
  }
}
```

---

## Benefits for Architectural Governance
Adopting the NestJS Workflow and State Machine pattern in the medical prescription domain provides several architectural and operational benefits:

✅ **Clear and Enforced Business Logic:**  
- All state transitions explicitly defined and enforced by workflow rules.
  
✅ **Maintainable and Auditable Code:**  
- Single source of truth simplifies future updates and debugging.

✅ **Integration Friendly:**  
- Structured integration with external parties (insurance, pharmacies) clearly defined within workflow actions.

✅ **Event-Driven Scalability:**  
- Kafka integration facilitates loosely-coupled, highly scalable interactions between systems.

✅ **Enhanced Reliability:**  
- Controlled transitions prevent invalid states, ensuring system reliability and patient safety.

✅ **Compliance and Auditability:**  
- Structured workflows simplify regulatory compliance and auditing by providing clear documentation of permissible states and actions.

---

## Conclusion
This use case demonstrates how NestJS Workflow can manage complex business scenarios effectively, incorporating third-party integrations and event-driven architecture. The pattern ensures robust state management, better maintainability, strong architectural governance, and ultimately, a more reliable and scalable medical application system.