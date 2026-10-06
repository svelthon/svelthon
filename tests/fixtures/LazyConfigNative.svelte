<script>
    import { make, action } from './lazy_config.js';

    export const give = (kind) => make(kind);
    export const maker = () => (kind) => make(kind);
    export const echo = () => (value) => value;
</script>

<p data-k="acted" use:action>action</p>
