## Testing a Bootstrap v1 to v2 Migration

With the steps below, you can test a v1 to v2 Bootstrap Migration using a secondary test Stedi account.

1. Setup the `.env` with just a `STEDI_API_KEY` for the source account.

2. Create a backup of `partners-configuration` and Guides by running:

```bash
npx ts-node-esm ./src/scripts/backup.ts
```

3. Change your `.env` to another API key for your target empty test account.

4. Restore the un-migrated Stash config (and Guides) by running:

```bash
npx ts-node-esm ./src/scripts/restore.ts
```

5. Update at least one profile from each partnership in the `partners-configuration` Stash keyspace to include `coreProfileType: "local"` so the migration script can correctly identify the local profile.

6. Run the migration script:

```bash
npm run migrate
```

6. Ensure you change any destination webhooks before testing end-to-end flows.

### Note about failures

- If the migration fails for any reason, delete any Profiles and/or Partnership records created by the early migration attempt in the Partners UI, but you attempt to retry it.

- The unneeded Stash records will only be destroyed if the entire migration as been successful, so failed migrations can be retried without a restore.
