<script lang="python">
# A reference that breaks: `tests/oracle.py` has to stop on it, where it used
# to drop the case and print the others.
kind: str

CASES = ["sound", "broken"]

if kind == "broken":
    raise RuntimeError("reference failure")


def model():
    return 0


def change(step):
    pass
</script>

<output>{model()}</output>
