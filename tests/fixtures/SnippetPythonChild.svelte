<script lang="python">
# A Python child rendering the snippet its Python parent gave, by its name,
# through an alias, under a key, and kept in a JavaScript object, read back as
# a field, a getter, a field of a field and an alias of the field: handed
# values a JavaScript number cannot carry, a whole float and two subclasses,
# which the parent's snippet reads as they were handed. And as one list, for a
# parent's snippet that takes it apart.
importjs {box, getter, nested} from "./snippet_holders.js"
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
{:else if kind == "box"}{held = box(children)}{@render held.fn(1.0, Price(0.5), Label("a"))}
{:else if kind == "getter"}{held = getter(children)}{@render held.fn(1.0, Price(0.5), Label("a"))}
{:else if kind == "nested"}{held = nested(children)}{@render held.inside.fn(1.0, Price(0.5), Label("a"))}
{:else if kind == "held"}{alias = box(children).fn}{@render alias(1.0, Price(0.5), Label("a"))}
{:else}{holder = {"fn": children}}{@render holder["fn"](1.0, Price(0.5), Label("a"))}{/if}
