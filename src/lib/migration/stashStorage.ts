import { UmzugStorage } from "umzug";
import { GetValueCommand, SetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../constants.js";
import { stashClient } from "../clients/stash.js";

const stash = stashClient();

export type StashStorageConstructorOptions = {
  /**
	Stash Keypsace where the log is stored.
	*/
  readonly keyspace?: string;
};

export class StashStorage implements UmzugStorage {
  public readonly keyspace: string;

  private key = "bootstrap|history";

  constructor(options?: StashStorageConstructorOptions) {
    this.keyspace = options?.keyspace ?? PARTNERS_KEYSPACE_NAME;
  }

  async logMigration({ name: migrationName }: { name: string }): Promise<void> {
    const loggedMigrations = await this.executed();
    loggedMigrations.push(migrationName);

    await stash.send(
      new SetValueCommand({
        keyspaceName: this.keyspace,
        key: this.key,
        value: { migrations: loggedMigrations },
      })
    );
  }

  async unlogMigration({
    name: migrationName,
  }: {
    name: string;
  }): Promise<void> {
    const loggedMigrations = await this.executed();
    const updatedMigrations = loggedMigrations.filter(
      (name) => name !== migrationName
    );

    await stash.send(
      new SetValueCommand({
        keyspaceName: this.keyspace,
        key: this.key,
        value: { migrations: updatedMigrations },
      })
    );
  }

  async executed(): Promise<string[]> {
    const { value } = await stash.send(
      new GetValueCommand({
        keyspaceName: this.keyspace,
        key: this.key,
      })
    );

    return value !== null && typeof value === "object" && "migrations" in value
      ? (value.migrations as string[])
      : [];
  }
}
