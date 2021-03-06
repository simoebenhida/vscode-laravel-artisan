import { window, workspace } from 'vscode';
import cp = require('child_process');
import Common from '../../Common';
import Output from '../../utils/Output';

export default class RouteCacheClear extends Common {

    public static async run() {
        let command = `route:clear`;
        this.execCmd(command, async (err, stdout) => {
            if (err) {
                Output.error(stdout);
                return this.showError('The route cache could not be cleared', err);
            } else {
                return this.showMessage('The route cache was cleared');
            }
        });
    }
}