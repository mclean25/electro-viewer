/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(_input) {
    return {
      name: "ev-test",
      removal: "remove",
      protect: false,
      home: "aws",
      providers: {
        aws: {
          profile: "playground",
          region: "us-west-1",
        },
      },
    };
  },
  async run() {
    const table = new sst.aws.Dynamo("MainTable", {
      fields: {
        pk: "string",
        sk: "string",
        gsi1pk: "string",
        gsi1sk: "string",
        gsi2pk: "string",
        gsi2sk: "string",
        gsi3pk: "string",
        gsi3sk: "string",
        gsi4pk: "string",
        gsi4sk: "string",
        gsi5pk: "string",
        gsi5sk: "string",
      },
      primaryIndex: {
        hashKey: "pk",
        rangeKey: "sk",
      },
      globalIndexes: {
        gsi1: {
          hashKey: "gsi1pk",
          rangeKey: "gsi1sk",
        },
        gsi2: {
          hashKey: "gsi2pk",
          rangeKey: "gsi2sk",
        },
        gsi3: {
          hashKey: "gsi3pk",
          rangeKey: "gsi3sk",
        },
        gsi4: {
          hashKey: "gsi4pk",
          rangeKey: "gsi4sk",
        },
        gsi5: {
          hashKey: "gsi5pk",
          rangeKey: "gsi5sk",
        },
      },
      ttl: "expireAt",
      deletionProtection: false,
    });

    new sst.x.DevCommand("ElectroViewer", {
      link: [table],
      dev: {
        autostart: true,
        command: "pnpm electro-viewer",
      },
    });
  },
});
