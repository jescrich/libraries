import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import Link from '@docusaurus/Link';

type FeatureItem = {
    title: string;
    Svg: React.ComponentType<React.ComponentProps<'svg'>>;
    description: ReactNode;
};

const FeatureList: FeatureItem[] = [
    {
        title: 'URN',
        Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
        description: (
            <>
                A powerful, extensible utility for working with Uniform Resource Names (URNs).

                This package allows you to compose, validate, parse, transform, and manipulate URNs efficiently. It supports attribute management, UUID generation, normalization, and extensibility for custom namespace validation.
            </>
        ),
    },

    // {
    //     title: 'Focus on What Matters',
    //     Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    //     description: (
    //         <>
    //             URN lets you focus on your business logic while handling common patterns
    //             and best practices for NestJS applications.
    //         </>
    //     ),
    // },
    // {
    //     title: 'Powerful Features',
    //     Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    //     description: (
    //         <>
    //             Includes useful decorators, utilities, and patterns for building robust
    //             NestJS applications with TypeScript.
    //         </>
    //     ),
    // },
];
function Feature({ title, Svg, description }: FeatureItem) {
    return (
        <div className={clsx('col col--4')}>
            {/* <div className="text--center">
                <Svg className={styles.featureSvg} role="img" />
            </div> */}
            <div className="text--center padding-horiz--md">
                <Heading as="h3">{title}</Heading>
                <p>{description}</p>
            </div>
            <div className="text--center margin-top--md">
                <Link
                    className="button button--secondary button--lg"
                    to="./docs/urn/intro">
                    Documentation
                </Link>
                <Link
                    className="button button--secondary button--lg margin-left--md"
                    to="https://github.com/jescrich/urn#readme">
                    GitHub
                </Link>
            </div>

        </div>
    );
}

export default function HomepageFeatures(): ReactNode {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className="row">
                    {FeatureList.map((props, idx) => (
                        <Feature key={idx} {...props} />
                    ))}
                </div>
            </div>
        </section>
    );
}
