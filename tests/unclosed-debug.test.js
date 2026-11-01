// @vitest-environment node
//
// A run of `{@debug}` whose last tag is left open, as a template is while it is
// being typed. The pass looked ahead for the end of the run by the next `}`, and
// finding none went back to the start of the file: it walked the same tags for
// ever, and Vite's process served nothing more. The pass now ends, and Svelte
// refuses the open tag, as it refuses it in a component of its own.
import { execFileSync } from 'node:child_process';
import { test, expect } from 'vitest';

test('a {@debug} left open ends the pass', () => {
    const out = execFileSync(process.execPath, ['tests/fixtures/unclosed-debug.js'], {
        encoding: 'utf8',
        timeout: 30000,
        killSignal: 'SIGKILL'
    });

    expect(out.trim().split('\n')).toHaveLength(4);
    for (const line of out.trim().split('\n')) expect(line).toMatch(/^(returned|raised) (returned|raised) raised$/);
}, 40000);
