import { window, workspace } from 'vscode';
import cp = require('child_process');
import Common from '../../Common';
import Output from '../../utils/Output';

export default class MakeModel extends Common {

    public static async run() {
        // Get the name of the controller to create
        let modelName = await this.getInput('Model Name');
        if (modelName.length == 0) {
            this.showError('A model name is required');
            return;
        }
        let isController = false;
        let isMigration = false;
        let isResource = false;
        let isFactory = false;
        let isAll = false

        //Determine if should we create migration,factory and resource controller
        isAll = await this.getYesNo('Should I create migration,factory and resource controller for the model?');
        
        if(!isAll)
        {
            // Determine if we should create a migration or not
            isMigration = await this.getYesNo('Should I create a migration for the model?');

            // Determine if it should create a foctory for this model or not            
            isFactory = await this.getYesNo('Should I create a factory for the model?');
            
            // Should a controller be generated?
            isController = await this.getYesNo('Should I create a controller for the model?');
    
            // Ask if the controller is a resource if the previous answer was 'yes'
            if (isController) {
                // Determine if this is a resource controller or not
                isResource = await this.getYesNo('Should I create the controller as a resource?');
            }
        }

        let command = `make:model ${modelName} ${isMigration ? '-m' : ''} ${isFactory ? '-f' : ''} ${isController ? '-c' : ''} ${isResource ? '-r' : ''} ${isAll ? '-a' : ''}`;

        // Generate the model
        this.execCmd(command, async (err, stdout) => {
            if (err) {
                Output.error(stdout)
                this.showError('Could not create the model', err);
            } else {
                await this.openFile('/app/' + modelName + '.php');
                if (isController) {
                    await this.openFile('/app/Http/Controllers/' + modelName + 'Controller.php');
                }
            }
        });
    }
}