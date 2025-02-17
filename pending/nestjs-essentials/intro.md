---
sidebar_position: 1
---

# Introduction

NestJS Toolkit is a powerful extension to the NestJS framework, designed to streamline the development of robust and scalable applications. It provides pre-built modules and utilities for common tasks, allowing you to focus on your core business logic rather than boilerplate code. This toolkit significantly reduces development time and promotes best practices.

## Key Benefits

*   **Rapid Development:** Get started quickly with pre-configured modules for common functionalities.
*   **Simplified Kafka Integration:** Effortlessly implement event-driven architectures with the `ConsumerModule` and `KafkaModule`. Easily define consumers with the `@Handler` decorator.
*   **Caching Made Easy:** The `CacheModule` provides a simple and consistent interface for caching data using Redis, boosting application performance.
*   **Authentication and Authorization:** Secure your application with the `AuthModule`, which includes JWT-based authentication and role-based access control (RBAC) using the `@Require` decorator.
*   **Modular Architecture:** Promotes a clean and maintainable codebase through a modular design.
*   **Testability:** Designed with testing in mind, making it easy to write unit and integration tests.
*   **Extensible:** Easily integrate and extend the toolkit with your own custom modules and services.
* **Health Checks**: Built-in health indicators for Kafka and Cache.

## Core Modules

*   **`ConsumerModule`:** Simplifies the creation of Kafka consumers.
*   **`KafkaModule`:** Provides a Kafka client and health indicator.
*   **`CacheModule`:** Implements caching using Redis, with a health indicator.
*   **`AuthModule`:** Handles authentication and authorization using JWT and roles.

## Quick Start

This guide will walk you through setting up a basic NestJS application using the NestJS Toolkit, demonstrating the core features.

### 1. Installation

First, install the necessary packages:

```bash
npm install @this/nestjs-toolkit @nestjs/common @nestjs/core @nestjs/jwt kafkajs ioredis
