// A `__reduce__` or `__reduce_ex__` a class binds itself, by a lambda, an
// `async def` or an assignment, was refused as needing `copyreg`, which only
// the default one does. Each returns 42 under CPython.
import { test, expect } from 'vitest';
import * as module from './fixtures/own_reduce.py';

test.for(['through_lambda', 'through_assigned'])('%s answers as CPython does', (name) => {
    expect(module[name]()).toBe(42);
});

test('through_coroutine answers as CPython does', async () => {
    expect(await module.through_coroutine()).toBe(42);
});
