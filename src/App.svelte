<script>
    import Counter from './Counter.svelte';
    import Semantics from './Semantics.svelte';
    import Greeting from './Greeting.svelte';
    import StoreDemo from './StoreDemo.svelte';

    let who = $state('Pierre');
</script>

<main>
    <h1>SVELTHON</h1>
    <p>Des composants Svelte écrits en Python, compilés par Brython au build.</p>

    <h2>Réactivité</h2>
    <Counter />

    <h2>Props</h2>
    <Greeting name={who} punct="…" />
    <button onclick={() => (who = who === 'Pierre' ? 'Ada' : 'Pierre')}>changer de nom</button>

    <h2>État partagé</h2>
    <StoreDemo />
    <StoreDemo />

    <h2>Sémantique Python</h2>
    <Semantics />
</main>

<style>
    main {
        font-family: system-ui, sans-serif;
        max-width: 40rem;
        margin: 3rem auto;
        padding: 0 1rem;
        line-height: 1.6;
    }
    button {
        font: inherit;
        padding: 0.4rem 0.9rem;
        cursor: pointer;
    }
</style>
