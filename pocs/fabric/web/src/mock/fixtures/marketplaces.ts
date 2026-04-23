import type { Marketplace } from '../../types';

export const FIXTURE_MARKETPLACES: Marketplace[] = [
  {
    name: 'cyber-fabric-official',
    description: 'Curated fabric kits maintained by Cyber Fabric',
    owner: { name: 'Cyber Fabric', email: 'support@cyberfabric.dev' },
    addedFrom: 'https://github.com/cyberfabric/fabric-marketplace.git',
    kits: [
      {
        name: 'review-prompts',
        description: 'Code review prompt pack',
        category: 'development',
        author: { name: 'Cyber Fabric' },
        homepage: 'https://github.com/cyberfabric/review-prompts',
        source: { source: 'url', url: 'https://github.com/cyberfabric/review-prompts.git', version: '1.2.0' },
        version: '1.2.0',
        files: [
          'prompts/review-diff.md',
          'prompts/review-pr.md',
          'scripts/pr-audit.js',
        ],
        webExtensions: [
          {
            id: 'review-prompts.dashboard',
            label: 'Review Dashboard',
            icon: 'git-pull-request',
            description: 'Track open PRs awaiting review across repositories.',
            placeholder: {
              title: 'Review Dashboard',
              lines: [
                'Lists open PRs from configured repos and their review status.',
                'Filters: ready for review, changes requested, approved, stale.',
                'Each row deep-links to the PR and opens the matching review prompt.',
              ],
            },
          },
        ],
      },
      {
        name: 'sdlc-kit',
        description: 'Planning, ADR, design prompts for SDLC',
        category: 'sdlc',
        author: { name: 'Cyber Fabric' },
        source: { source: 'git-subdir', url: 'cyberfabric/fabric-monorepo', path: 'kits/sdlc', version: '0.4.1' },
        version: '0.4.1',
        files: [
          'prompts/adr.md',
          'prompts/design.md',
          'prompts/prd.md',
        ],
        webExtensions: [
          {
            id: 'sdlc-kit.orchestrator',
            label: 'SDLC Orchestrator',
            icon: 'workflow',
            description: 'Plan and execute SDLC artifact chains (PRD → Design → ADR → Feature).',
            placeholder: {
              title: 'SDLC Orchestrator',
              lines: [
                'Pick a stage: PRD, Design, ADR, Feature, or PR Review.',
                'The orchestrator composes the appropriate prompt from this kit and routes it to a configured agent.',
                'Checkpoints let you review intermediate artifacts before proceeding.',
              ],
            },
          },
          {
            id: 'sdlc-kit.chat',
            label: 'Claude SDK Chat',
            icon: 'message-square',
            description: 'Chat proxy backed by Claude Agent SDK with this kit\'s system prompts.',
            placeholder: {
              title: 'Claude SDK Chat',
              lines: [
                'Persistent chat session preloaded with SDLC prompts from this kit.',
                'Switch system prompts on the fly (PRD, Design, ADR, Feature).',
                'Backed by Claude Agent SDK — streaming, tool use, citations.',
              ],
            },
          },
        ],
      },
      {
        name: 'testing-kit',
        description: 'Test strategy and coverage prompts',
        category: 'testing',
        source: { source: 'url', url: 'https://github.com/cyberfabric/testing-kit.git', version: '2.0.0' },
        version: '2.0.0',
        files: ['prompts/test-plan.md', 'prompts/coverage-audit.md'],
        webExtensions: [
          {
            id: 'testing-kit.coverage',
            label: 'Coverage Viewer',
            icon: 'check-circle',
            description: 'Visualise test coverage gaps and suggest missing test plans.',
            placeholder: {
              title: 'Coverage Viewer',
              lines: [
                'Imports coverage.json and highlights untested branches.',
                'Click an uncovered block → draft a test plan via the testing prompt.',
                'Exports a gap-report markdown.',
              ],
            },
          },
        ],
      },
      {
        name: 'productivity-pack',
        description: 'Meeting notes, summarizers, todo extractors',
        category: 'productivity',
        source: { source: 'url', url: 'https://github.com/cyberfabric/productivity-pack.git', version: '1.0.3' },
        version: '1.0.3',
        files: ['prompts/summarize.md', 'prompts/extract-todos.md'],
      },
      {
        name: 'prompt-authoring',
        description: 'Author prompts with brainstorm, generate, repair',
        category: 'authoring',
        source: { source: 'url', url: 'https://github.com/cyberfabric/prompt-authoring.git', version: '1.2.0-beta.1' },
        version: '1.2.0-beta.1',
        files: [
          'prompts/prompt-brainstorm.md',
          'prompts/prompt-generate.md',
          'prompts/prompt-repair.md',
        ],
      },
    ],
  },
  {
    name: 'community-demo',
    description: 'Community-contributed kits (demo marketplace)',
    owner: { name: 'Community', email: 'community@example.com' },
    addedFrom: 'https://github.com/example/fabric-community.git',
    kits: [
      {
        name: 'rust-helper',
        description: 'Prompts for Rust codebases',
        category: 'language',
        source: { source: 'url', url: 'https://github.com/example/rust-helper.git', version: '0.9.2' },
        version: '0.9.2',
        files: ['prompts/rust-diagnose.md'],
      },
      {
        name: 'sql-tuner',
        description: 'SQL performance diagnosis prompts',
        category: 'database',
        source: { source: 'url', url: 'https://github.com/example/sql-tuner.git', version: '1.0.0' },
        version: '1.0.0',
        files: ['prompts/explain-plan.md', 'prompts/index-advice.md'],
      },
      {
        name: 'broken-kit',
        description: 'Demonstrates a failing install',
        category: 'demo',
        source: { source: 'url', url: 'https://example.invalid/broken.git', version: 'not-a-semver' },
        version: 'not-a-semver',
        files: [],
        broken: { reason: 'Invalid semver version "not-a-semver"' },
      },
    ],
  },
];
