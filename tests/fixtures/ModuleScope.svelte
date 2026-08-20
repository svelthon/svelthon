<script module>
    // A helper with its own locals. The declaration scan used to publish every
    // `const` it found at any indentation, so `hidden` was bound as a module
    // name and the component referenced something that does not exist there.
    const LABEL = 'top level';

    function helper() {
        const hidden = 'inside a function';
        let alsoHidden = 1;
        return hidden + alsoHidden;
    }
</script>

<script lang="python">
@derived
def shown():
    return LABEL


@derived
def called():
    return helper()
</script>

<p data-k="label">{shown}</p>
<p data-k="helper">{called}</p>
