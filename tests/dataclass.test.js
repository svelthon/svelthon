import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import DataclassRecord from './fixtures/DataclassRecord.svelte';

// A `@dataclass` is the short way to write the object-shaped record that
// notes/dicts-and-objects.md compares against a dict — three lines of fields
// instead of an `__init__`. It also exercises two things at once: the standard
// library reaching a component through a `from … import …`, and a decorated
// class body sitting beside the module-level annotations that declare props.
describe('a dataclass in a component', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DataclassRecord, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            bump: () => {
                target.querySelector('[data-k="bump"]').click();
                flushSync();
            }
        };
    };

    test('its fields read in the markup', () => {
        expect(setup().read('field')).toBe('Making the GIL Optional');
    });

    test('a property beside them reads the same way', () => {
        expect(setup().read('computed')).toBe('https://peps.python.org/pep-0703/');
    });

    test('the equality it generates works', () => {
        expect(setup().read('equal')).toBe('True');
    });

    test('so does the repr it generates', () => {
        expect(setup().read('repr')).toBe(
            "Pep(number=703, title='Making the GIL Optional', year=2023)"
        );
    });

    test('a field mutated in place is reactive', () => {
        const { read, bump } = setup();
        bump();
        expect(read('year')).toBe('2024');
    });
});
