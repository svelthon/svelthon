<script>
    import { store } from './facade_class_store.svelte.py';
</script>

<p data-k="view">{'Profile' in store}|{Object.keys(store).includes('Profile')}|{Object.hasOwn(store, 'Profile')}|{'Other' in store}</p>
