import { glob } from "glob";
import * as Mocha from "mocha";
import * as path from "path";

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });
  mocha.timeout(100000);

  const testsRoot = __dirname;

  return glob.glob("**.test.js", { cwd: testsRoot }).then(async (files) => {
    // Add files to the test suite
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

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
    } catch (err) {
      console.error(err);
      throw err;
    }
  });
}
