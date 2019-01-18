import * as testRunner from 'vscode/lib/testrunner';

testRunner.configure({
    ui: 'bdd',
    timeout: 100000
});

module.exports = testRunner;
