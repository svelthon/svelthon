// @vitest-environment node
//
// A JavaScript object a Python module publishes again crosses as the object it
// is, and the export reads nothing of it: a service whose state throws until it
// has started is handed over untouched, and a configuration's computed field is
// read when its reader reads it, as from a JavaScript module.
import { test, expect } from 'vitest';
import { direct, settings } from './fixtures/native_service.py';
import { service, config, reads } from './fixtures/native_service.js';

test('a JavaScript service crosses as itself, its unstarted state unread', () => {
    expect(direct).toBe(service);
    expect(direct.ping()).toBe('ready');
    expect(reads.service).toBe(0);
});

test('a configuration crosses as itself, its computed field unread', () => {
    expect(reads.config).toBe(0);
    expect(settings).toBe(config);
    expect(settings.serial).toBe(1);
});
