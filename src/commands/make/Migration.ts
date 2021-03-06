import { window, workspace } from 'vscode';
import cp = require('child_process');
import Common from '../../Common';
import Output from '../../utils/Output';

export default class MakeMigration extends Common {

    public static async run() {
        // Get the name of the controller to create
        let migrationName = await this.getInput('Migration Name');
        if (migrationName.length == 0) {
            this.showError('A migration name is required');
            return;
        }

        let createTable = false;
        let modifyTable = false;
        let tableName = '';

        // Determine if this is a resource controller or not
        createTable = await this.getYesNo('Will this migration create a table?');
        if (!createTable) {
            modifyTable = await this.getYesNo('Will this migration modify an existing table?');
        }

        if (createTable || modifyTable) {
            tableName = await this.getInput('What is the name of the table?');
        }

        let command = `make:migration ${migrationName} ${createTable ? '--create=' + tableName : ''} ${modifyTable ? '--table=' + tableName : ''}`;

        // Generate the controller
        this.execCmd(command, async (err, stdout, stderr) => {
            if (err) {
                Output.error(stdout)
                this.showError('Could not create the migration', err);
            } else {
                let file = stdout.replace(/^.+:/ig, '').trim();
                await this.openFile('/database/migrations/' + file + '.php');
            }
        });
    }
}