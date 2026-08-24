<script lang="python">
# Django's `|date`, with Intl behind it. Every test passes a locale, so what is
# checked is our wiring rather than the machine's language.
def probe(fn):
    try:
        return str(fn())
    except Exception as e:
        return "{}: {}".format(type(e).__name__, e)


iso = "2026-08-24T10:30:00"   # sans Z : heure locale, donc le test ne dépend pas du fuseau

plain = date(iso, None, None, "fr-FR")
long_form = date(iso, "long", None, "fr-FR")
full_form = date(iso, "full", None, "fr-FR")
with_time = date(iso, "short", "short", "en-GB")
day_only = date("2026-08-24", "short", None, "fr-FR")
stamp = date(1787482635216, "short", None, "fr-FR")
other = date(iso, "long", None, "en-US")

broken = probe(lambda: date("pas une date", "long", None, "fr-FR"))
</script>

<p data-k="plain">{plain}</p>
<p data-k="long">{long_form}</p>
<p data-k="full">{full_form}</p>
<p data-k="time">{with_time}</p>
<p data-k="day">{day_only}</p>
<p data-k="stamp">{stamp}</p>
<p data-k="other">{other}</p>
<p data-k="broken">{broken}</p>
