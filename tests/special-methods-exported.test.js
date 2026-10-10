// A special method read off a builtin is a `method-wrapper`, one read off its
// type a `method_descriptor`: Python calls both through Brython's `tp_call`
// slot, not a `__call__`. Watching a mutator wraps it, and the wrap has to stay
// the Python object it was, so that `type()`, `__self__` and `repr()` answer
// as Python does and the export boundary still sees a Python callable, whose
// arguments it converts.
import { test, expect } from 'vitest';
import * as mod from './fixtures/special_methods_exported.py';

test('a watched special mutator stays a method-wrapper bound to its list', () => {
    expect(mod.shape()).toEqual(['method-wrapper', true]);
    expect(mod.shown()).toBe("<method-wrapper '__setitem__' of list object>");
});

test('published, it converts what JavaScript passes', () => {
    mod.write(0, 0.5);

    expect(mod.read()).toBe('0.5');
});

test('handed to a JavaScript function, it converts too', () => {
    expect(mod.passed()).toBe('0.5');
});

test('and so does a dict mutator', () => {
    mod.put('k', 2.5);

    expect(mod.table_value()).toBe('2.5');
});

// The receiver is the list the module published, handed back: a JavaScript
// array is not a `list` to Python, which `list.__len__` refused already.
test('a reader and a method taken off the type cross as functions', () => {
    expect(mod.length()).toBe(1);
    expect(mod.index_of(mod.rows, mod.rows[0])).toBe(0);
});

// The dict the module published, handed back, is the dict again: to a method
// taken off `dict`, which is a JavaScript function carrying its Python type, and
// to a function of the module.
test('a published dict handed back is the dict, to a method of its type and to a function', () => {
    expect(mod.get_from(mod.scores, 'answer')).toBe(42);
    expect(mod.kind_of(mod.scores)).toBe('dict');
});

// One operation on one list is one callback, however many times it is read.
test('two reads of one operation are one function', () => {
    expect(mod.write).toBe(mod.second);
});
