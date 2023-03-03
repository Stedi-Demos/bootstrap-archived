# External FTP / SFTP poller

This bootstrap module supports the polling of remote FTP / SFTP servers for files to be processed. When files are found
during the polling operation, they are copied to a [Stedi bucket](https://www.stedi.com/docs/buckets), and can then
optionally be deleted from the remote server. If the destination bucket has bucket notifications enabled to invoke
the [`edi-inbound`](src/functions/edi/inbound/handler.ts) function, and you specify an `inbound` directory as the
destination for downloaded files, those documents will be processed automatically.

## Configuration

The poller configuration is stored in [Stash](https://www.stedi.com/docs/stash) alongside the trading partners
configuration in the `partners-config` keyspace. The poller configuration is stored in
the `bootstrap|remote-poller-config` key, and the value is a map of keys to ftp/sftp configuration entries as shown in
the schema below:

### Remote poller configuration schema:

```typescript
type RemotePollerConfig = {
  [key: string]: {
    connectionDetails: {
      protocol: "ftp" | "sftp";
      config: FtpConifig | SftpConfig;
    };
    deleteAfterProcessing: boolean; // default: false
    destination: DestinationBucket;
    remotePath?: string;  // default: "/"
    remoteFiles?: string[];
  };
};

type FtpConfig = {
  host: string;
  port?: number // default: 21
  user: string;
  password: string;
  secure?: boolean | "implicit";
  secureOptions?: {
    rejectUnauthroized: boolean;
  };
};

type SftpConfig = {
  host: string;
  port?: number // default: 22
  username: string;
  password: string;
};

type DestinationBucket = {
  type: "bucket";
  bucketName: string;
  path: string;
};
```

### Adding a configuration entry

In order to invoke the poller, you will need a configuration entry in Stash. Navigate to the `partners-configuration`
keyspace in the [Stash UI](https://www.stedi.com/app/stash/keyspace/partners-configuration). If this is your first
remote poller configuration entry, add a new Stash key named `bootstrap|remote-poller-config`. If you already have
an existing configuration entry, you can simply add a new entry to the map by editing the value of the Stash key.

Below is an example configuration that includes two remote poller configuration entries (one for FTP
named `my-remote-ftp`, and one for SFTP named `my-remote-sftp`). You can use this example configuration as a template
for your Stash value, updating the configuration parameters to correspond to your remote server.

Example remote poller config JSON:

```json
{
  "my-remote-ftp": {
    "connectionDetails": {
      "config": {
        "host": "ftp.trading-partner-1.com",
        "port": 21,
        "user": "my-ftp-user",
        "password": "my-ftp-password"
      },
      "protocol": "ftp"
    },
    "deleteAfterProcessing": false,
    "destination": {
      "bucketName": "my-sftp-bucket",
      "path": "/trading_partners/my-trading-partner-1/inbound",
      "type": "bucket"
    },
    "remotePath": "/"
  },
  "my-remote-sftp": {
    "connectionDetails": {
      "config": {
        "host": "sftp.trading-partner-2.com",
        "port": 22,
        "username": "my-sftp-user",
        "password": "my-sftp-password"
      },
      "protocol": "sftp"
    },
    "deleteAfterProcessing": false,
    "destination": {
      "bucketName": "my-sftp-bucket",
      "path": "/trading_partners/my-trading-partner-2/inbound",
      "type": "bucket"
    },
    "remotePath": "/outbound"
  }
}
```

## Poller overview

On each invocation of the function, the `ftp-external-poller` performs several steps:

1. Calls [Stash](https://www.stedi.com/docs/stash) to retrieve the configuration for the poller.

1. Looks for the configuration associated with the key that was provided on invocation.

1. Connects to the remote server using the corresponding connection configuration.

1. Looks for files to process on the remote server.

1. For each file to be processed, copies the file to the bucket and path specified in the configuration.

1. Optionally deletes the file from the remote server.

1. After processing all files to be processed, closes the connection.

## Invoking the function

### Invoking manually

Once deployed, you may invoke the function via the command line to verify functionality by running:

```bash
npm run execute ftp-external-poller <CONFIGURATION_KEY>
```

This will invoke the `ftp-external-poller` Stedi function and poll the remote server to look for files to be processed.
The output of the script will include a summary of the polling operations:

```bash
> stedi-bootstrap@1.0.0 execute
> ts-node-esm ./src/scripts/execute.ts ftp-external-poller rob-test

Invoking function 'ftp-external-poller' synchronously.
Result:
  {
    "processedFiles": [
      {
        "path": "/outbound",
        "name": "855-1746.edi",
        "lastModifiedTime": 1677874415000
      }
    ],
    "skippedItems": [],
    "processingErrors": []
  }
```

### Scheduled invocation

If you'd like to invoke the poller on a scheduled basis, there are several options. You can set up a workflow using your
orchestration tool of choice, and use either
the [Functions SDK](https://www.stedi.com/docs/functions/tutorial#invoke-a-function-using-the-stedi-functions-sdk) or
the [Functions API](https://www.stedi.com/docs/api/functions) in order to invoke the function.

The repo also includes a [scheduler GitHub action](.github/workflows/scheduled-ftp-poller.yaml) which can be used to
invoke the
function automatically on a scheduled basis. If you would like to use this approach, you can fork the repo and follow
the steps below in order to enable the scheduled function executions in your account:

1. Create a
   new [repository secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets?tool=webui#creating-encrypted-secrets-for-a-repository)
   in your forked repo named `STEDI_API_KEY` and save the value of your API key as the secret value. This secret is
   referenced within the workflow and is passed as an environment variable to the script that invokes
   the `ftp-external-poller` Stedi function in your account. _Note:_ make sure there is no leading or trailing
   whitespace in the secret value as this will cause authentication to fail.

1. Enable the workflow to run in your forked repo. For security purposes, GitHub requires that you explicitly enable
   workflows that are copied over when a repo is forked. In your forked repo, click the `Actions` tab, and click the
   button to enable workflow runs.

#### Changing the invocation schedule

To change the schedule for invoking the poller, you can modify the `cron` attribute of the schedule in accordance
with
the [GitHub documentation for workflow schedules](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule).
After making changes to the workflow definition, be sure to commit the changes and push them to your forked repo.
