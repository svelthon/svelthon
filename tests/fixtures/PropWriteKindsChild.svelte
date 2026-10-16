<script lang="python">
# A child writing its prop with a value of the kind a test names.
VALUES = {"float": 0.5, "other": 0.75, "int": 1, "str": "a", "astral": "\U0001F600",
          "none": None, "big": 2 ** 60, "true": True}

value: object = "default"


@export
def own(kind):
    global value
    value = VALUES[kind]


@export
def model():
    return str(value)
</script>

<p>{value}</p>
