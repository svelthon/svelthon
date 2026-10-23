<script module>
    import ModuleChild from './HeldPriceChild.svelte?variant=module';
    import * as held from './queried_child.js';
</script>

<script lang="python">
    # A Python child imported under a query: by `importjs`, by the
    # `<script module>`, or through a JavaScript module that re-exports it,
    # under a query that holds both quotes too.
    importjs Child from "./HeldPriceChild.svelte?variant=importjs"

    mode: str = "importjs"

    class Price(float):
        pass

    value = Price(0.5)
    value.currency = "EUR"
</script>

{#if mode == "importjs"}
    <Child {value} />
{:else if mode == "module"}
    <ModuleChild {value} />
{:else if mode == "reexport"}
    <held.Child {value} />
{:else}
    <held.Quoted {value} />
{/if}
