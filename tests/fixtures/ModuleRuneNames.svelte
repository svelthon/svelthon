<script module>
    // Functions and classes named like runes, which a registry reads by their
    // names: one read before its declaration, as a function is hoisted, and a
    // class that says its own. Beside an `Object` of the module's own.
    export const early = derived.name;
    export class state {}
    export function derived() {
        return 'ready';
    }
    export const effect = () => 'active';
    class Caption {}
    class props {
        static name = 'own';
    }
    const Object = { label: 'catalog' };
    export const names = [state, derived, effect, Caption, props].map((one) => one.name);
</script>

<script lang="python">
count = 1
</script>

<p>{early}|{"|".join(names)}|{Object.label}|{count}</p>
