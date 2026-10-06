<script>
    import PrintedChild from './PrintedChild.svelte';

    class Money {
        constructor(cents) {
            this.cents = cents;
        }

        toString() {
            return `${Math.floor(this.cents / 100)}.${String(this.cents % 100).padStart(2, '0')} EUR`;
        }
    }

    class Plain {}
</script>

<p data-k="python">1.50 EUR</p>
<PrintedChild price={new Money(150)} plain={new Plain()} />
