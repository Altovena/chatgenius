# Freddys Flipperhall — versjon 1.0 (release candidate)

**Status per 12.11.2026: teknisk godkjent kandidat, ikke endelig signert av på fysisk iPhone.**

- Produksjon: https://www.chatgenius.pro/spill/flipperhall/
- Hovedrepo: `Altovena/chatgenius`
- Spillfil: `spill/flipperhall/index.html`
- Automatiske tester: `spill/flipperhall/tests/*.test.cjs`
- GitHub Actions: `.github/workflows/flipperhall-tests.yml`
- Åpen fysisk akseptansetest: https://github.com/Altovena/chatgenius/issues/130
- Siste verifiserte kodegrunnlag før denne dokumentasjonen: merge-commit `846b31c9c3d05f93d7dac71ac70109e157f7e383` (PR #132). Dokumentasjon endrer ikke spillkoden.

## Seks maskiner

| Indeks | Maskin | Direkte inngang |
|---|---|---|
| 0 | Castle Chaos | `?machine=0` |
| 1 | Neon Velocity | `?machine=1` |
| 2 | Cosmic Odyssey | `?machine=2` |
| 3 | Jungle Temple | `?machine=3` |
| 4 | Abyssal Depths | `?machine=4` |
| 5 | Clockwork Carnival | `?machine=5` |

## Hva er teknisk kontrollert?

- Utskyting: alle seks maskiner sender ballen ut av utskytingssporet.
- Simulert spill: alle seks maskiner kjøres med ingen, vekslende og reaktive flipperslag; testen avdekker ugyldige ballposisjoner og tidlige tap.
- Spesifikke regresjoner: Jungle Temple og Abyssal Depths med rettferdig første ball, Neon Velocity og Cosmic Odyssey uten fastlåst spillbane.
- Input: to samtidige berøringer, pointercancel, lostpointercapture, pause, app-bytte, Safari `pagehide`, `blur`, nytt spill og maskinbytte.
- Tilstand: siste ball, "Spill igjen", midlertidige poeng-/lyseffekter og lokale personlige rekorder per maskin.
- Visning: mobil oppdragsmåler, stabilt `svh` for mobil og korrekt 460:800 canvas-proporsjon.
- PR #132: GitHub Actions testkjøring #30 fullført med **success**.
- Vercel: produksjonsutrulling av den verifiserte koden var **READY**; kontroll av Vercel runtime errors siste 7 dager returnerte ingen registrerte serverfeil for spillruten. Dette dekker **ikke** feil i brukernes nettleser.

Automatisert test lokalt:

```sh
node --test spill/flipperhall/tests/*.test.cjs
```

## Utestående: fysisk iPhone Safari-test

**Denne testen er ikke utført eller godkjent av assistenten.** Sjekklisten i [issue #130](https://github.com/Altovena/chatgenius/issues/130) er autoritativ, og saken skal være åpen til fysisk enhet er bekreftet:

1. Åpne alle seks maskiner, skyt en ball og sjekk synlige proporsjoner.
2. Hold begge flippere samtidig; slipp og kontroller respons.
3. Bytt app med flipper holdt inne; gå tilbake og trykk `Fortsett`.
4. Pause og gjenoppta; fullfør tre baller og test `Spill igjen`.
5. Bytt maskin; kontroller at knapper, meldinger og poeng nullstilles, men rekord per maskin beholdes.
6. La Safari vise/skjule adressefeltet; kontroller at spillefeltet ikke hopper eller skjules bak mobilkontroller.

Noter iPhone-modell, iOS-versjon og nøyaktige reproduksjonstrinn for eventuelle feil. Hvis alt er godkjent, kan #130 lukkes og versjon 1.0 erklæres ferdig.

## Endringsprinsipp for 1.0

- **Frys spillfysikk og banelayout** inntil en konkret, reproducerbar feil er dokumentert.
- Ny feilrettelse skal ha relevant regresjonstest før merge og Vercel `READY` etter merge.
- Ikke forveksle Vercel serverlogger med klientbasert Safari-feilsøking.
- Kodebasen inneholder noen eldre dupliserte funksjonserklæringer for `simulate` og `flipperGeo`, der siste definisjon er aktiv. Samle disse først som en separat, nøye testet opprydding **etter** 1.0-godkjenning, ikke midt i akseptansetesten.
- Nye maskiner eller større grafisk overhaling hører hjemme i en senere versjon (1.1+), ikke som blocker for 1.0.
