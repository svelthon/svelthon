<script>
    // A Python instance's class attribute, read by a component written in
    // JavaScript, with no Python component or store on the page.
    import { tally, relabel } from './class_label.py';
</script>

<p>{tally.label}</p>
<button onclick={relabel}>relabel</button>
