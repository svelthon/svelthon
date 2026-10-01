// @vitest-environment node
//
// A JavaScript object a Python module publishes again crosses as the object it
// is, and the export reads nothing of it it does not need: a service whose
// state throws until it has started is handed over untouched, and a
// configuration's computed field is read once, by the walk that keeps it.
import { test, expect } from 'vitest';
import { direct, settings } from './fixtures/native_service.py';
import { service, reads } from './fixtures/native_service.js';

test('a JavaScript service crosses as itself, its unstarted state unread', () => {
    expect(direct).toBe(service);
    expect(direct.ping()).toBe('ready');
    expect(reads.service).toBe(0);
});

test('a configuration has its computed field read once', () => {
    expect(settings).toEqual({ serial: 1 });
    expect(reads.config).toBe(1);
});
