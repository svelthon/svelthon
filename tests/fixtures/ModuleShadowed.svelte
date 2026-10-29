<script module>
// A name of the module spelled as one the compiler builds out of the Python
// `value__`, and a function of the module that changes it.
let __rev_value__ = 41;

function grow() {
    __rev_value__ += 1;
}
</script>

<script lang="python">
value__ = 7


@export
def read():
    grow()
    return __rev_value__
</script>

<output>{__rev_value__}</output>
