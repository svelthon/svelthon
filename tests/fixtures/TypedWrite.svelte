<script lang="python">
# A write, made outside the template, of a value JavaScript holds as the same
# number and Python shows otherwise: a float over an int, an int over a float,
# a negative zero over a zero.
values = {"n": 1, "f": 2.0, "z": 0.0}
mixed = {1: 1, "b": 0}


@export
def write(kind):
    if kind == "float for int":
        values["n"] = 1.0
    elif kind == "int for float":
        values["f"] = 2
    elif kind == "negative zero":
        values["z"] = -0.0
    elif kind == "update float for int":
        values.update(n=1.0)
    else:
        mixed[1] = 1.0


@export
def model():
    return f"{values['n']} {values['f']} {values['z']} {mixed[1]}"
</script>

<output>{values["n"]} {values["f"]} {values["z"]} {mixed[1]}</output>
