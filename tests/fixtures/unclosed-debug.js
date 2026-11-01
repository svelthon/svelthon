// Runs the markup pass and the preprocessor on templates whose last `{@debug}` is
// left open, for `unclosed-debug.test.js`: in a process of its own, since a pass
// that never returns holds the thread a test would time it from.
import '../../src/lib/compile.js';
import { pythonExpressions, pythonRanges, collector } from '../../src/lib/markup.js';
import { python } from '../../src/lib/svelthon.js';
import { compile, preprocess } from 'svelte/compiler';

const SOURCES = [
    '{@debug count} {@debug count',
    '{@debug count} {@debug count} {@debug count',
    ' \n{@debug count} {@debug count',
    '{@debug count} {@debug count\n<script lang="python">\ncount = 1\n</script>'
];

const outcome = async (run) => {
    try {
        await run();
        return 'returned';
    } catch {
        return 'raised';
    }
};

for (const source of SOURCES) {
    const answers = [
        await outcome(() => pythonExpressions(source, collector([]))),
        await outcome(() => pythonRanges(source)),
        await outcome(async () => {
            const { code } = await preprocess(source, python(), { filename: '/x/Unclosed.svelte' });

            compile(code, { filename: '/x/Unclosed.svelte' });
        })
    ];

    process.stdout.write(`${answers.join(' ')}\n`);
}
