import { Umzug, JSONStorage } from "umzug";
import { StashStorage } from "./stashStorage.js";

export const migrator = new Umzug({
  migrations: {
    glob: "src/migrations/*.ts",
    resolve: (params: any) => {
      if (params.path.endsWith(".ts")) {
        const getModule = () =>
          import(`file:///${params.path.replace(/\\/g, "/")}`);
        return {
          name: params.name,
          path: params.path,
          up: async (upParams) => (await getModule()).up(upParams),
          down: async (downParams) => (await getModule()).up(downParams),
        };
      }
      return {
        name: params.name,
        path: params.path,
        ...require(params.path),
      };
    },
  },

  storage: new StashStorage(),
  logger: console,
});
