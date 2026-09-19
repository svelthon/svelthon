// What a mutation *added* is what comes under watch, and the argument is not
// always that.
//
// A container handed to a mutator comes under the same watch as the container it
// landed in, and until now that was done by watching the **argument**:
// `rows.append(child)` is given the very thing that lands, so the link is right.
// `rows.extend(items())` is given a *source*. By the time the interception runs,
// the generator is empty and the child is inside the list with nothing pointing
// at it — so the first event rendered `[[]]` correctly and the second one left
// the page showing `[[]]` while Python held `[[1]]`.
//
// The shape of the answer is the one the augmented operator's *exception* path
// already had: when what landed came out of an iterator nobody can see, ask the
// container what it now holds. What was missing is that the successful path
// needs the same question, and that it is a question about the **argument** —
// an iterator hands everything over and keeps none of it — rather than a list of
// the method names that take one.
//
// So the rows here are the ways a child gets in, the last three being the ones
// that always worked, and every one of them is measured twice: once at the
// install, which was never in doubt, and once at a mutation of the child, which
// is where a missing link shows.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InsertedChild from './fixtures/InsertedChild.svelte';

describe.for([
    // How the child gets in, what the container is, and what it reads once the
    // child has grown.
    ['extend', 'rows.extend(items())', '[[]]', '[[1]]'],
    ['augment', 'rows += items()', '[[]]', '[[1]]'],
    ['update', 'table.update(pairs())', "{'a': []}", "{'a': [1]}"],
    // The one mutator that hands a child *back* rather than taking one: what the
    // program keeps and mutates is the return value, which is not among the
    // arguments. Named by the mutation harness, which found the line that links
    // it checked by nothing.
    ['setdefault', 'table.setdefault("a", child)', "{'a': []}", "{'a': [1]}"],
    ['append', 'rows.append(child)', '[[]]', '[[1]]'],
    ['augment-list', 'rows += [child]', '[[]]', '[[1]]']
])('a child put in by %s', ([how, , installed, grown]) => {
    test('is watched, so the page follows it afterwards', () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(InsertedChild, { target, props: { how } });

        flushSync();

        const read = () => target.querySelector('[data-k="rows"]').textContent;
        const press = (key) => {
            target.querySelector(`button[data-k="${key}"]`).click();
            flushSync();
        };

        press('install');
        // The first event was never the problem: the container itself changed,
        // and the container is watched.
        expect(read()).toBe(installed);

        press('grow');
        // Python first, so a failure below says *the page is behind* rather than
        // leaving it open whether anything happened at all.
        expect(instance.snapshot()).toBe(grown);
        expect(read()).toBe(grown);
    });
});
