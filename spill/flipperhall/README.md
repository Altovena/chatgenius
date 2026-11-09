# Freddys Flipperhall – trygg integrasjon

Mål: del Clockwork Carnival V19.1-motorens pålitelige mobilutskytning, presisjonsflippere, kollisjoner, tre baller, maksimalt tre aktive multiballer, oppdrag og bonuslogikk mellom seks maskiner – uten å kopiere Clockworks spilleflate og dekor.

## Bekreftet
- ChatGenius-motoren ligger i `/spill/flipper/game.js`; dette er ikke seksmaskiners ChatGPT Sites-prosjekt.
- V19.1 ligger som en selvstendig, spillbar prototype, utenfor dette repoet.
- En separat seksmaskiners testpakke er generert med V19.1 som motor, egne bilder/temaer og forskjellige bumper-/målposisjoner. Den er IKKE en full migrering av de fem originale spilleflatene.
- Chromium-smoketest med viewport 390×844 og 1440×900: 6/6 rendret, 6/6 responderte på SKYT BALL, ingen JavaScript-unntak ved oppstart. Full bonus- og progresjonstest gjenstår.
- Mobilknappene er plassert i bunnpanel slik at de dekker mindre av spilleflaten.

## Produksjonskrav
1. Hent original Sites-kilde for alle seks maskinene og dokumenter unik geometri og mekanikk.
2. Skill delt fysikk/score/input fra layout og tematisk renderer.
3. Behold egne tunneler, broer, ramper, motormekanismer og missions for hver maskin.
4. Test faktisk i Safari på iPhone og desktop: launch, pause, 3 baller, game over, ball saver, alle bonusoppdrag, multiball maks 3, reset og zoom.
5. Publiser til separat Vercel-preview før eventuell merge til main og produksjon.

Denne PR-en gir bare en sikker inngang til den eksisterende publiserte Flipperhallen. De seks beta-spillene er ikke lagt til produksjon.
