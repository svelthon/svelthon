<script module>
    // Classes named like runes, which read their names while they are made: a
    // static field, and a static block registering one; one naming itself by a
    // computed key, by a field, by an accessor, by a method or an accessor
    // under a key computed from a name; and ones assigned.
    const registry = new Map();
    const displayKey = 'name';
    export class state {
        static seen = this.name;
        static {
            registry.set(this.name, this);
        }
    }
    export class derived {
        static ['name'] = 'custom';
        static after = this.name;
    }
    class effect {
        static name = 'explicit';
    }
    class inspect {
        static get ['name']() {
            return 'accessor';
        }
    }
    class props {
        static [displayKey]() {
            return 'method';
        }
    }
    export let host;
    host = class {
        static seen = this.name;
    };
    export let bindable;
    bindable = class {
        static get [displayKey]() {
            return 'computed';
        }
        static seen = this.name;
    };
    export const names = [
        state.seen,
        registry.get('state') === state,
        derived.after,
        derived.name,
        effect.name,
        inspect.name,
        props.name(),
        host.seen,
        host.name,
        bindable.seen,
        bindable.name
    ].join('|');
</script>

<script lang="python">
count = 1
</script>

<p>{names}|{count}</p>
