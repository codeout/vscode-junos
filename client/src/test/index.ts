import * as path from "node:path";

import { glob } from "glob";
import * as Mocha from "mocha";

export function run() {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });
  mocha.timeout(100_000);

  const testsRoot = __dirname;

  return glob.glob("**.test.js", { cwd: testsRoot }).then(async (files) => {
    // Add files to the test suite
    for (const f of files) {
      mocha.addFile(path.resolve(testsRoot, f));
    }

    try {
      // Run the mocha test
      await new Promise<void>((resolve, reject) => {
        mocha.run((failures) => {
          if (failures > 0) {
            reject(`${failures} tests failed.`);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
}
