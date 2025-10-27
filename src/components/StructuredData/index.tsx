import React from 'react';
import Head from '@docusaurus/Head';

export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "José Escrich Libraries",
    "description": "Enterprise-grade NestJS libraries including Kafka Client with backpressure management, URN utilities, and Workflow management tools for production applications",
    "url": "https://jescrich.github.io/libraries",
    "author": {
      "@type": "Person",
      "name": "José Escrich",
      "url": "https://joseescrich.com"
    },
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Cross-platform",
    "programmingLanguage": "TypeScript",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "softwareVersion": "Latest",
    "downloadUrl": "https://www.npmjs.com/package/@jescrich/nestjs-kafka-client"
  };

  return (
    <Head>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Head>
  );
}