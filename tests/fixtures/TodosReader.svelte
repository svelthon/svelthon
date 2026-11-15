<script>
    // A JavaScript component that reads the instances a Python store holds in
    // its containers, and calls a method of one
    import { store } from './todos.svelte.py';
</script>

<p>{store.todos.length} {store.todos[0].title} {store.todos[0].done} {String(store.todos[1])} {store.by_id.x.title}</p>
<button onclick={() => { store.todos[0].toggle(); store.add('c'); }}>go</button>
