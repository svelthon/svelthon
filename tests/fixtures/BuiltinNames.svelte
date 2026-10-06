<script module>
    import { len } from './builtin_names.js';
</script>

<script lang="python">
    importjs { max, object } from "./builtin_names.js"

    @export
    def reads():
        return [max(1), object(), len(), str(min(1, 2))]
</script>

<p data-k="markup">{max(1, 2)}</p>
