<script lang="python">
# A Python child that renders the snippet it is handed with Python values: a
# float, and instances of subclasses of float and of str.
children: object


class Price(float):
    pass


class Label(str):
    pass
</script>

{@render children(1.0)}
{@render children(Price(0.5))}
{@render children(Label("a"))}
