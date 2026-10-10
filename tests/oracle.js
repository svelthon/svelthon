// The two halves of the differential oracle, shared by its matrices: what
// CPython prints for every case of a fixture, `tests/oracle.py` running the
// fixture's own Python, and the same case mounted, its model and its page read
// after each step.
import { execFileSync } from 'node:child_process';
import { mount, flushSync } from './mounted.js';

// CPython's traceback, when a fixture fails there, goes into the error thrown
// rather than onto the run's output.
export const cpython = (fixture) =>
    JSON.parse(
        execFileSync('python3', ['tests/oracle.py', `tests/fixtures/${fixture}`], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        })
    );

// `act(instance, target, step)` makes the step's write, the way the case says:
// `instance.change(step)` unless the write is one the page or JavaScript makes.
export const mounted = (Component, kind, act) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { kind } });
    const models = [];
    const pages = [];

    const seen = () => {
        flushSync();
        models.push(instance.model());
        pages.push(target.querySelector('output').textContent);
    };

    seen();
    for (const step of [1, 2]) {
        act(instance, target, step);
        seen();
    }

    return { models, pages };
};
