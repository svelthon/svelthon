<script lang="python">
# State the component keeps, holding a float, handed out through `@export`.
# The parent is JavaScript, so the value crosses through `pyNumbers`, and the
# question is what Python still holds afterwards.
prices = {"rate": 0.25}
rows = [0.5, 1]


@export
def give_dict():
    return prices


@export
def give_list():
    return rows


@export
def kind():
    return type(prices["rate"]).__name__


@export
def rounded():
    return round(prices["rate"], 1)


@export
def shown():
    return str(rows)
</script>

<p data-k="rate">{prices["rate"]}</p>
