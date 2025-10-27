import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
	title: "José Escrich Libraries",
	tagline: "Enterprise-grade NestJS libraries: Kafka Client, URN utilities, and Workflow management tools for production applications",
	favicon: "img/favicon.ico",
	url: "https://jescrich.github.io/",
	// Set the /<baseUrl>/ pathname under which your site is served
	// For GitHub pages deployment, it is often '/<projectName>/'
	baseUrl: "/libraries",

	// GitHub pages deployment config.
	// If you aren't using GitHub pages, you don't need these.
	organizationName: "jescrich", // Usually your GitHub org/user name.
	// projectName: 'docusaurus', // Usually your repo name.
  	projectName: 'jescrich', // Usually your repo name.
	onBrokenLinks: "throw",
	onBrokenMarkdownLinks: "warn",

	// Even if you don't use internationalization, you can use this field to set
	// useful metadata like html lang. For example, if your site is Chinese, you
	// may want to replace "en" with "zh-Hans".
	i18n: {
		defaultLocale: "en",
		locales: ["en"],
	},

	presets: [
		[
			"classic",
			{
				gtag: {
					trackingID: "G-5QENEB8FM0",
					anonymizeIP: true,
				},
				docs: {
					sidebarPath: "./sidebars.ts",
					// Please change this to your repo.
					// Remove this to remove the "edit this page" links.
					// editUrl:
					//   'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
				},
				// blog: {
				//   showReadingTime: true,
				//   feedOptions: {
				//     type: ['rss', 'atom'],
				//     xslt: true,
				//   },
				//   // Please change this to your repo.
				//   // Remove this to remove the "edit this page" links.
				//   // editUrl:
				//   //   'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
				//   // Useful options to enforce blogging best practices
				//   onInlineTags: 'warn',
				//   onInlineAuthors: 'warn',
				//   onUntruncatedBlogPosts: 'warn',
				// },
				theme: {
					customCss: "./src/css/custom.css",
				},
			} satisfies Preset.Options,
		],
	],
	plugins: [
		"@docusaurus/theme-live-codeblock",
		[
			'@docusaurus/plugin-sitemap',
			{
				changefreq: 'weekly',
				priority: 0.5,
				ignorePatterns: ['/tags/**'],
				filename: 'sitemap.xml',
			},
		],
	themeConfig: {
		colorMode: {
			defaultMode: 'dark',
		},
		liveCodeBlock: {
			/**
			 * The position of the live playground, above or under the editor
			 * Possible values: "top" | "bottom"
			 */
			playgroundPosition: "bottom",
		},
		// Replace with your project's social card
		image: "img/docusaurus-social-card.jpg",
		metadata: [
			{name: 'keywords', content: 'NestJS, Kafka, URN, Workflow, TypeScript, Node.js, Enterprise, Libraries, José Escrich'},
			{name: 'author', content: 'José Escrich'},
			{property: 'og:type', content: 'website'},
			{property: 'og:site_name', content: 'José Escrich Libraries'},
			{name: 'twitter:card', content: 'summary_large_image'},
			{name: 'twitter:creator', content: '@jescrich'},
		],
		navbar: {
			title: "@jescrich",
			logo: {
				alt: "@jescrich libraries Logo",
				src: "https://joseescrich.com/20250117_160050.png",
			},
			items: [
				{
					type: "docSidebar",
					sidebarId: "tutorialSidebar",
					position: "left",
					label: "Documentation",
				},
				// {to: '/blog', label: 'Blog', position: 'left'},
				{
					href: "https://joseescrich.com",
					label: "LinkedIn",
					position: "right",
				},
				{
					href: "https://github.com/jescrich",
					label: "GitHub",
					position: "right",
				},
			],
		},
		footer: {
			style: "dark",
			links: [
				// {
				//   title: 'Docs',
				//   items: [
				//     {
				//       label: 'Tutorial',
				//       to: '/docs/intro',
				//     },
				//   ],
				// },
				// {
				//   title: 'Community',
				//   items: [
				//     {
				//       label: 'Stack Overflow',
				//       href: 'https://stackoverflow.com/questions/tagged/docusaurus',
				//     },
				//     {
				//       label: 'Discord',
				//       href: 'https://discordapp.com/invite/docusaurus',
				//     },
				//     {
				//       label: 'X',
				//       href: 'https://x.com/docusaurus',
				//     },
				//   ],
				// },
				// {
				//   title: 'More',
				//   items: [
				//     {
				//       label: 'LinkedIn',
				//       to: 'https://www.linkedin.com/in/jescrich/',
				//     },
				//     {
				//       label: 'GitHub',
				//       href: 'https://github.com/jescrich',
				//     },
				//   ],
				// },
			],
			copyright: `Copyright © ${new Date().getFullYear()} José Escrich (JES), Inc.`,
		},
		prism: {
			theme: prismThemes.github,
			darkTheme: prismThemes.dracula,
		},
	} satisfies Preset.ThemeConfig,
};

export default config;
