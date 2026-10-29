# ChatGenius GitHub → Vercel smoke test

Date: 2026-10-28.

This documentation-only change verifies that the existing Vercel project still creates preview deployments for pull requests after transferring the repository to `Altovena/chatgenius`.

Retest after reconnecting the existing ChatGenius Vercel project to the new organization repository.

No runtime code, production configuration, website content, or catalog data is changed.

Expected outcome: Vercel preview READY on the draft PR. Close the draft PR without merging once verified.

Second diagnostic retest: 2026-10-29, after verifying the installed Vercel GitHub App has explicit access to `Altovena/chatgenius`.
