# Sjakkakademiet – brandet innloggingsmail (ikke aktivert)

## Årsak

`spill/sjakk/chess-account.js` bruker Supabase Auth i **delt** prosjekt
`ereapsfcsqtdmzosgnnn` (RealtyflowPRO). `signInWithOtp` bruker riktig
`emailRedirectTo: location.origin+'/spill/sjakk/?chessAccount=1'`, men
**From**-adresse og mail-templates administreres av dette felles prosjektet.
En global endring av SMTP-avsender vil også ramme Art og andre apper.

## Klargjort

- `mail-routing.mjs` velger **kun** Chess for de eksakte URL-ene
  `https://chatgenius.pro/spill/sjakk/?chessAccount=1` og
  `https://www.chatgenius.pro/spill/sjakk/?chessAccount=1`.
- `index.ts` er et utkast til Supabase Send Email Hook med verifisering av
  Standard Webhooks-signaturen, privat Resend API-token, avsenderkonfigurasjon
  og støtte for signup, magic link, invite, recovery og secure email change.
- Utsendelse skjer ikke ved manglende eller ugyldig konfigurasjon.
- Tester dekker falske domener, ukjente brands og begge mottakere ved
  sikker e-postendring.

**Denne funksjonen er med vilje ikke deployet/registrert i Supabase Auth.**
En slik hook tar over *all* e-postutsendelse for prosjektet. Den må derfor ikke
aktiveres før samtlige merkevarer (Art inkludert) er støttet og regresjonstestet.

## Forutsetninger før aktivering

1. Verifiser `chatgenius.pro` hos valgt leverandør (for eksempel Resend).
   Konfigurer SPF, DKIM og DMARC hos DNS-verten. Verifiser ønsket avsender
   `Freddys Sjakkakademi <innlogging@chatgenius.pro>`.
2. Kartlegg nåværende SMTP-/Auth-e-postoppsett for det delte Supabase-prosjektet.
   Noter faktisk Art-avsender og samtlige andre Auth-forbrukere.
3. Legg til eksplisitt, sikker ruting for alle øvrige merkevarer.
   Manglende rute skal gi feil, ikke kvittere for en e-post som ikke ble sendt.
4. Konfigurer **server-side** hemmeligheter i Supabase-prosjektet:
   - `SEND_EMAIL_HOOK_SECRET`: genereres i Supabase Auth Hooks.
   - `RESEND_API_KEY`: fra verifisert e-postleverandør.
   - `CHESS_AUTH_FROM`: `Freddys Sjakkakademi <innlogging@chatgenius.pro>`.
   - `AUTH_EMAIL_HOOK_ENABLED`: `true` først etter all-brand-godkjenning.
5. Test faktiske leveranser i staging for både ChatGenius og Art:
   verifiser **From**, avsendersignatur, mottaker, emne, lenke,
   innlogging, recovery og begge e-poster ved sikker e-postendring.
6. Registrer til slutt den ferdige Send Email Hook i Supabase Auth.
   Ikke endre SMTP-avsender globalt som snarvei.

## Sikkerhetskrav

- Ikke logg OTP/token/hash, webhook-requestbody eller e-postadresser.
- Test gyldig og ugyldig signatur.
- Respekter `redirect_to`-allowlist, ikke klassifiser kun ut fra
  et selvrapportert merkenavn eller `user_metadata`.
- Hold alle API-nøkler utenfor frontend, Git og CI.
- Deaktiver ikke eksisterende Art-/andre e-poster uten å ha en godkjent migrasjon.
- Ved utsendelsesfeil må hooken returnere feilstatus, ikke HTTP 200.

## Kontroller

```sh
node --test tests/chess-auth-email-routing.test.mjs
```

Referanser:
- https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
- https://supabase.com/docs/guides/auth/auth-smtp
- https://github.com/Altovena/chatgenius/issues/137
