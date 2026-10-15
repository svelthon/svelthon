<script>
    // SpecialMethodSwap in Svelte: what the class answers, held in state.
    import { untrack } from 'svelte';

    let { kind = 'len', subclassed = false } = $props();
    let answer = $state(1);

    class Base {
        get length() {
            return answer;
        }
        call() {
            return answer;
        }
        *[Symbol.iterator]() {
            yield answer;
        }
        get unknown() {
            return answer;
        }
    }

    class Sub extends Base {}

    const one = untrack(() => (subclassed ? new Sub() : new Base()));
    const value = () => (kind === 'len' ? one.length : kind === 'call' ? one.call() : kind === 'iter' ? [...one][0] : one.unknown);

    export function change() {
        answer = 99;
    }

    export function model() {
        return value();
    }
</script>

<output>{value()}</output>
