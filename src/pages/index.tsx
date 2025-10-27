import type { ReactNode } from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import StructuredData from '@site/src/components/StructuredData';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>

      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  useDocusaurusContext();
  return (
    <Layout
      title="Enterprise NestJS Libraries | Kafka Client, URN Utils, Workflow Tools"
      description="Production-ready NestJS libraries by José Escrich: Enterprise Kafka client with backpressure management, URN utilities for resource naming, and workflow management tools. Built for scalable TypeScript applications.">
      <StructuredData />
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
