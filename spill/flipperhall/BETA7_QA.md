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
