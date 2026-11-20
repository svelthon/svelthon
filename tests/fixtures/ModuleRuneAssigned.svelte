<script module>
    // Functions and classes assigned to names like runes, which take the name
    // of the binding they are evaluated for: by `=`, a logical assignment, a
    // default of a pattern; and one already named, and a local of a function's.
    export let state;
    state = () => 'assigned';
    export let derived;
    derived = class {};
    let effect;
    effect = function () {};
    export let inspect;
    inspect ??= () => 1;
    export let { props = () => 2 } = {};
    export let host;
    host = function own() {};
    function local() {
        let state = () => 3;
        return state.name;
    }
    export const names = [state, derived, effect, inspect, props, host].map((one) => one.name).concat(local());
</script>

<script lang="python">
count = 1
</script>

<p>{"|".join(names)}|{count}</p>
