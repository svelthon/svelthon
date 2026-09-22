<script module>
    import { same } from './native_shapes.js';

    // A `let`, which is a **binding**: the name keeps pointing at whatever the
    // module last assigned, and reading it later is supposed to see that.
    let amount = 1;
    const fixed = 10;

    function advance() {
        amount += 1;
    }

    function actual() {
        return amount;
    }

    export { same };
</script>

<script lang="python">
@export
def read():
    # The name and the call, side by side: the call is the witness that the
    # JavaScript really moved, so a stale read cannot be blamed on the mutation
    # never happening.
    return [amount, actual()]


@export
def step():
    advance()


@export
def constant():
    return fixed


@export
def twice():
    # The same function read twice. Reading a binding afresh must not build a
    # second adapter: a registry given the first could not take back the second,
    # which is what `off(handler)` after `on(handler)` needs.
    return same(advance, advance)
</script>

<p data-k="amount">{amount}</p>
