# Flipperhall Beta 7 – maskinspesifikke mekanikker

Dato: 2026-11-09. Denne filen dokumenterer selvstendig **Beta 7**, ikke eksisterende produksjon.

## Felles V19.1-basert motor
- Safari-utskytning, presisjonsflippere, bonusoppdrag, ball saver og maks tre samtidige baller.
- Unike bilde- og fargetemaer per maskin.
- Mobilkontroller nederst for å dekke mindre av spilleflaten.

## Nye mekanikker i betapakken
- **Castle Chaos:** tre treff på dragemål åpner en tidsbegrenset dragebro som sender ballen til øvre bane.
- **Neon Velocity:** tre turboporttreff åpner høyhastighetsrunde; turboporten påvirker også ballens fart.
- **Cosmic Odyssey:** gravitasjonsfelt trekker ballen svakt mot en portal; tre treff åpner warphopp.
- **Jungle Temple:** svingende tempelpendel er en kollisjonsmekanisme som åpner en jungelsti.
- **Abyssal Depths:** perlemål og havstrøm åpner en undervannsrute.
- **Clockwork Carnival:** beholder tannhjul, tivoliport og eksisterende oppdragsregler.

## QA og avgrensning
- Seks av seks JavaScript-filer består Node.js `--check` syntakskontroll.
- Browser-test med Chromium ble blokkert med `ERR_BLOCKED_BY_ADMINISTRATOR` ved både `file://` og lokal HTTP; ingen ny runtime-, iPhone- eller full oppdragstest er dokumentert.
- Beta 7 ligger foreløpig kun som separat ZIP fra samtalen. **Ikke merget, ikke publisert.**
- Fortsatt en midlertidig løsning; de originale fem Sites-banenens komplette layout og mekanikk er ikke migrert. Forskjellige spesialfunksjoner erstatter ikke full originalgeometri.

## Før produksjon
Hent originale Sites-kilder, sammenlign baner, kjør hele spillforløp og bonussekvens på hver maskin i Safari og Chromium, test alle baller/pauser/multiball, og verifiser preview før merge.

## Beta 8 – 9. november 2026
- Oppdragstekster gjennomgått og endret slik at Castle, Neon, Cosmic, Jungle, Abyss og Clockwork beskriver sine egne spesialmål i UI.
- Gamle Clockwork-spesifikke oppdragsetiketter ryddet bort fra de andre banene.
- Seks av seks innebygde JavaScript-blokker bestod `node --check`.
- Chromium-test av lokal HTTP feilet for alle ved navigering med `ERR_BLOCKED_BY_ADMINISTRATOR`; dette er en testmiljøblokkering, ikke et bekreftet spillutfall.
- Beta 8 foreligger som samtalens ZIP-artefakt, **ikke** kopiert til GitHub, Vercel eller produksjon.
- Gjenstår: faktisk funksjonell spilltest, prøveutsending på Vercel, fysisk Safari-test, og verifisering av at fem originale Sites-spill er fullt migrert.

## Vercel-isolert testmiljø – 9. november 2026
- Opprettet separat Vercel-prosjekt `freddys-flipperhall-staging` (project `prj_eWDNEdymcdN2mdZYxw6NK6KgYlcZ`).
- Publisert `index.html` + selvstendig Clockwork Carnival V19.1-fil til `https://freddys-flipperhall-staging.vercel.app/` (deployment `dpl_HzDCzc5VJzDHnHPnEXQyLPFzENFR`). Vercel rapporterer `READY`, og begge filene er bekreftet i deployments innholdsliste.
- SSO for **kun dette nye testprosjektet** er slått av slik at Safari kan åpne adressen uten Vercel-pålogging.
- Fem øvrige Beta 8-spill er **ikke** deployet; bare staging-Clockwork er publisert. Den originale Flipperhallen og ChatGenius produksjon er uendret.
- Ekstern HTTP-/Safari-åpning og end-to-end spilltest er ikke verifisert.
