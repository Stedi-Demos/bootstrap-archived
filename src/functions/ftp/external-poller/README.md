# External FTP / SFTP poller

This bootstrap module supports polling remote FTP / SFTP servers for files. When the poller finds files, it copies them to a [Stedi bucket](https://www.stedi.com/docs/buckets). Then, the operation can optionally delete those files from the remote server.

- [Poller overview](#poller-overview)
- [Add a configuration entry](#add-a-configuration-entry)
- [Invoke the poller function](#invoke-the-poller-function)
- [Configure boostrap to process files automatically](#configure-bootstrap-to-process-files-automatically)


## Poller overview

The `ftp-external-poller` function performs the following steps:

1. Calls [Stash](https://www.stedi.com/docs/stash) to retrieve the configuration for the poller.

1. Looks for the configuration associated with the key that was provided on invocation.

1. Connects to the remote server using the corresponding connection configuration.

1. Looks for files to process on the remote server.

1. For each file to be processed, copies the file to the bucket and path specified in the configuration.

1. Optionally deletes the file from the remote server.

1. After processing all files to be processed, closes the connection.

The poller configuration is stored in [Stash](https://www.stedi.com/docs/stash) with the trading partners
configuration in the `partners-config` keyspace. The poller configuration is stored in
the `bootstrap|remote-poller-config` key, and the value is a map of keys to ftp/sftp configuration entries.

The following code shows the remote poller configuration schema.

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

## Add a configuration entry

You must create configuration entry in Stash before you can invoke the poller function. 

1. Navigate to the `partners-configuration`
keyspace in the [Stash UI](https://www.stedi.com/app/stash/keyspace/partners-configuration). 
1. If this is your first remote poller configuration entry, add a new Stash key named `bootstrap|remote-poller-config`. If you already have
a configuration entry, edit the Stash key value to add a new entry to the existing map.

The following example configuration includes two remote poller configuration entries: one for FTP
named `my-remote-ftp`, and one for SFTP named `my-remote-sftp`. Use this example configuration as a template
for your Stash value, updating the configuration parameters to correspond to your remote server.

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

## Invoke the poller function


### Invoke manually

Once deployed, you can invoke the function with the command line to verify functionality. The following command invokes the `ftp-external-poller` Stedi function and polls the remote server for files.

```bash
npm run execute ftp-external-poller <CONFIGURATION_KEY>
```

The script output includes a summary of the polling operations.

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

### Invoke automatically

You can invoke the poller function automatically with one of two options.

#### Orchestration tool

Set up a workflow using your orchestration tool of choice, and use one of the following to invoke the function: 
- [Functions SDK](https://www.stedi.com/docs/functions/tutorial#invoke-a-function-using-the-stedi-functions-sdk) 
- [Functions API](https://www.stedi.com/docs/api/functions#InvokeFunction)

#### GitHub Action

You can use the [scheduler GitHub action](/.github/workflows/scheduled-ftp-poller.yaml) in this repository to invoke the
function automatically. Complete the following steps: 

1. Fork this repository.
2. Create a new [repository secret](https://docs.github.com/en/actions/security-guides/encrypted-secrets?tool=webui#creating-encrypted-secrets-for-a-repository)
   in your forked repository named `STEDI_API_KEY` and save the value of your API key as the secret value. This secret is
   referenced within the workflow and is passed as an environment variable to the script that invokes
   the `ftp-external-poller` Stedi function in your account. _Note:_ Make sure there is no leading or trailing
   whitespace in the secret value as this will cause authentication to fail.

1. Enable the workflow to run in your forked repository. GitHub requires you to explicitly enable
   workflows that are copied from a forked repository. In your forked repository, click the `Actions` tab, and then click the
   button to enable workflow runs.

To change the schedule for invoking the poller:

1. Modify the `cron` attribute of the schedule in accordance
with the [GitHub documentation for workflow schedules](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule).
1. Commit the changes and push them to your forked repository.

## Configure bootstrap to process files automatically

Do the following to configure the bootstrap module to process new files automatically:
- Specify an `inbound` directory as the destination for new files
- Enable bucket notifications in the destination bucket to invoke the [`edi-inbound`](/src/functions/edi/inbound/handler.ts) function
