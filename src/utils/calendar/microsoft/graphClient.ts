// utils/graphClient.ts
import { Client } from "@microsoft/microsoft-graph-client";

// Polyfill fetch for Node.js environments
import "isomorphic-fetch";

export function getGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}
