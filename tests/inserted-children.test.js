// What a mutation *added* is what comes under watch, and the argument is not
// always that.
//
// A container handed to a mutator comes under the same watch as the container it
// landed in. `rows.append(child)` is given the very thing that lands, so watching
// the argument is right. `rows.extend(items())` is given a *source*: by the time
// the interception runs, the generator is empty and the child is inside the list
// with nothing watched pointing at it, and the page would show `[[]]` while
// Python holds `[[1]]`.
//
// Two questions decide it: whether the method takes a source, which is a list
// of names, and whether that source still holds what it yielded, which only a
// builtin container of exactly its class is known to. Any other source makes
// the container say what it now holds. A class whose `__iter__` makes its rows
// on each pass is no iterator and keeps nothing, so it is asked about too.
//
// So the rows here are the ways a child gets in, and every one of them is
// measured twice: once at the install, and once at a mutation of the child,
// which is where a missing link shows.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InsertedChild from './fixtures/InsertedChild.svelte';

describe.for([
    // How the child gets in, what the container is, and what it reads once the
    // child has grown.
    ['extend', 'rows.extend(items())', '[[]]', '[[1]]'],
    ['augment', 'rows += items()', '[[]]', '[[1]]'],
    ['update', 'table.update(pairs())', "{'a': []}", "{'a': [1]}"],
    // A re-iterable class is not an iterator, and keeps nothing either.
    ['extend-iterable', 'rows.extend(Fresh(items))', '[[]]', '[[1]]'],
    ['augment-iterable', 'rows += Fresh(items)', '[[]]', '[[1]]'],
    ['update-iterable', 'table.update(Fresh(pairs))', "{'a': []}", "{'a': [1]}"],
    // A slice's value and a list of pairs are sources too: what they hold is
    // inside, not they themselves.
    ['slice', 'rows[:] = [child]', '[[]]', '[[1]]'],
    ['slice-method', 'rows.__setitem__(slice(None), [child])', '[[]]', '[[1]]'],
    ['update-pairs', 'table.update([("a", child)])', "{'a': []}", "{'a': [1]}"],
    ['ior-pairs', 'table.__ior__([("a", child)])', "{'a': []}", "{'a': [1]}"],
    ['init-pairs', 'table.__init__([("a", child)])', "{'a': []}", "{'a': [1]}"],
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
