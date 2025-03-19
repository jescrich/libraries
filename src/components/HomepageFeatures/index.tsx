import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import Link from '@docusaurus/Link';

type FeatureItem = {
    title: string;
    Svg: React.ComponentType<React.ComponentProps<'svg'>>;
    description: ReactNode;
    github: string;
    doc: string;
    logo?: string;
};

const FeatureList: FeatureItem[] = [
    {
        title: 'URN',
        Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
        
        logo: "https://joseescrich.com/logos/urn.png",
        description: (
            <>
                A powerful, extensible utility for working with Uniform Resource Names (URNs).

                This package allows you to compose, validate, parse, transform, and manipulate URNs efficiently. It supports attribute management, UUID generation, normalization, and extensibility for custom namespace validation.
            </>
        ),
        github: "https://github.com/jescrich/urn",
        doc: "./docs/urn/intro"
    },
    {
        title: 'NestJs Workflow',
        Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
        logo: "https://joseescrich.com/logos/nestjs-workflow.png",
        description: (
            <>
                An intuitive workflow management tool built specifically for NestJS and Node.js applications. It allows developers and teams to clearly define, manage, and execute workflows using a straightforward, declarative syntax. The result? Clearer code, better governance, and significantly improved maintainability.            </>
        ),
        github: "https://github.com/jescrich/nestjs-workflow",
        doc: "./docs/category/nestjs-workflow"
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
function Feature({ title, Svg, description, github, doc, logo }: FeatureItem) {
    return (
        <div className={clsx('col col--4')}>
            {/* <div className="text--center">
                <Svg className={styles.featureSvg} role="img" />
            </div> */}
            <div className="text--center">
                <img src={logo} alt="logo" width="200" />
            </div>
            <div className="text--center padding-horiz--md">
                <Heading as="h3">{title}</Heading>
                <p>{description}</p>
            </div>
            <div className="text--center margin-top--md">
                <Link
                    className="button button--secondary button--lg"
                    to={doc}>
                    Documentation
                </Link>
                <Link
                    className="button button--secondary button--lg margin-left--md"
                    to={github}>
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
