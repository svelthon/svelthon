<script lang="python">
# A Python child rendering the snippet its Python parent gave, by its name,
# through an alias and under a key: handed values a JavaScript number cannot
# carry, a whole float and two subclasses, which the parent's snippet reads as
# they were handed. And as one list, for a parent's snippet that takes it apart.
children: object = None
kind: str = "bare"


class Price(float):
    pass


class Label(str):
    pass
</script>

{#if kind == "bare"}{@render children(1.0, Price(0.5), Label("a"))}
{:else if kind == "alias"}{alias = children}{@render alias(1.0, Price(0.5), Label("a"))}
{:else if kind == "list"}{@render children([1.0, Price(0.5), Label("a")])}
{:else}{holder = {"fn": children}}{@render holder["fn"](1.0, Price(0.5), Label("a"))}{/if}
