import { workspace, window, commands, Uri, WorkspaceEdit, TextEdit, Range, Position, ViewColumn, Selection } from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs'
import * as path from 'path';
import Output from './utils/Output';

interface Command {
  name: string
  description: string
  arguments: any[]
  options: {
    name: string
    shortcut: string
    accept_value: boolean
    is_value_required: boolean
    is_multiple: boolean
    description: string
    default: any
  }[]
}

export default class Common {

  protected static get artisanRoot(): string {
    let config = workspace.getConfiguration("artisan")
    let location = config.get<string | number | null>("location")
    if (location) {
      if (typeof location == 'string') {
        return location
      } else if (typeof location == 'number') {
        return workspace.workspaceFolders[location].uri.fsPath
      }
    }
    // If we have gotten this far then a location hasn't been specified
    // We then get the first workspace
    if (workspace.workspaceFolders) {
      return workspace.workspaceFolders[0].uri.fsPath
    }
    // Last resort get the rootpath (this is technically deperecated)
    return workspace.rootPath
  }

  protected static get artisan(): string {
    return this.artisanRoot + '/artisan'
  }

  protected static execCmd(command: string, callback: (err: Error | undefined, stdout: string, stderr: string) => void) {
    command = `php artisan ${command}`
    let cmd = process.platform == 'win32' ? `cd /d "${this.artisanRoot}" && ${command}` : `cd "${this.artisanRoot}" && ${command}`
    Output.command(command)
    cp.exec(cmd, async (err, stdout, stderr) => {
      await callback(err, stdout, stderr)
    });
  }

  private static get tableStyle(): string {
    return `<style>
            body { padding: 0; margin: 0; }
            table { border-collapse: collapse; width: 100%; }
            table thead { font-size: 16px; text-align: left; }
            table tbody { font-size: 14px; }
            table td, table th { padding: 10px; }
            table tbody tr:nth-child(odd){
                background-color: rgba(0,0,0,0.25);
            }
            table td a { color: #4080d0; cursor: pointer; }
            .hidden { display: none; }
            .search { padding-top: 15px; padding-bottom: 15px; width: 95vw; margin: auto; }
            #filter { display: block; padding: 5px; width: 100%; }
        </style>`;
  }

  protected static async openFile(filename: string) {
    try {
      let doc = await workspace.openTextDocument(this.artisanRoot + '/' + filename);
      window.showTextDocument(doc);
      this.refreshFilesExplorer();
    } catch (e) {
      console.log(e.getMessage);
    }
  }

  protected static parseCliTable(cliTable: string) {
    let clirows = cliTable.split(/\r\n|\n/g);
    let headers: string[] = [];
    let rows: string[][] = [];
    // Parse the cli table
    for (let i = 0, len = clirows.length; i < len; i++) {
      if (i == 0 || i == 2) { continue; }
      else if (i == 1) {
        (headers = clirows[i].split('|')).forEach((v, k) => {
          headers[k] = v.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();
          if (headers[k] == '') {
            delete headers[k];
          }
        });
      } else {
        if (clirows[i].indexOf('|') > -1) {
          let row: string[] = [];
          clirows[i].split(/ \| /g).forEach((v, k) => {
            row.push(v.replace(/^\||\|$/g, '').trim());
          });
          rows.push(row);
        }
      }
    }
    return { headers: headers, rows: rows };
  }

  // protected static async openVirtualFile(path: string, title: string, content: string) {
  //   let uri = Uri.parse('laravel-artisan://artisan/' + path);
  //   let doc = await workspace.openTextDocument(uri);
  //   let edit = new WorkspaceEdit();
  //   let range = new Range(0, 0, doc.lineCount, doc.getText().length);
  //   edit.set(uri, [new TextEdit(range, content)]);
  //   workspace.applyEdit(edit);
  //   commands.executeCommand('vscode.previewHtml', uri, ViewColumn.One, title);
  // }

  protected static async openVirtualHtmlFile(openPath: string, title: string, headers: string[], rows: string[][]) {
    let html: string = `<div class="search"><input type="text" id="filter" placeholder="Search for an item (RegExp Supported)"></div>`;
    html += `${this.tableStyle}<table>`;
    html += '<thead><tr>';
    headers.forEach(header => {
      html += '<th>' + header + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(item => {
        if (item.match(/app\\/i)) {
          html += `<td><a href="file://${workspace.rootPath}/${item.replace(/@.+$/, '').replace(/^App/, 'app')}.php" data-method="${item.replace(/^.+@/, '')}" class="app-item">` + item + '</a></td>';
        } else {
          html += '<td>' + item + '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += `<script>
            const filter = document.querySelector('#filter');
            const body = document.querySelector('table tbody');
            const rootPath = '${this.artisanRoot.replace(/\\/g, '/')}';
            const vscode = acquireVsCodeApi()
            console.log(rootPath);
            filter.focus();
            function filterItems(){
              let v = filter.value;
              document.querySelectorAll('tbody > tr').forEach(row => {
                  let txt = row.textContent;
                  let reg = new RegExp(v, 'ig');
                  if (reg.test(txt) || v.length == 0) {
                      row.classList.remove('hidden');
                  } else {
                      row.classList.add('hidden');
                  }
              });
            }
            function routeEvents(){
              Array.from(body.querySelectorAll('a')).forEach(item => {
                item.addEventListener('click', e => {
                  e.preventDefault();
                  let target = e.currentTarget;
                  vscode.postMessage({ file: target.href, method: target.getAttribute('data-method') });
                });
              });
            }
            filter.addEventListener('input', e => filterItems());
            window.addEventListener('message', msg => {
              let rows = msg.data.rows;
              let html = '';
              rows.forEach(row => {
                html += '<tr>';
                row.forEach(item => {
                  if (item.match(/app\\\\/i)) {
                    let file = \`\${rootPath}/\${item.replace(/@.+$/, '').replace(/^App/, 'app')}.php\`.replace(/\\\\/g, '/');
                    html += \`<td><a href="\${file}" data-method="\${item.replace(/^.+@/, '')}" class="app-item">\` + item + '</a></td>';
                  } else {
                    html += '<td>' + item + '</td>';
                  }
                });
                html += '</tr>';
              });
              body.innerHTML = html;
              filterItems();
              routeEvents();
            });
            routeEvents();
        </script>`
    const panel = window.createWebviewPanel(openPath, title, ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true
    })
    panel.webview.html = html
    panel.webview.onDidReceiveMessage(async msg => {
      if (msg.file) {
        let uri = Uri.parse(msg.file)
        let method = msg.method || ''
        let doc = await workspace.openTextDocument(uri)
        let activeDoc = await window.showTextDocument(doc)
        if (method.length > 0) {
          let idx = doc.getText().indexOf(`function ${method}`)
          if (idx > -1) {
            let pos = doc.positionAt(idx + 9)
            activeDoc.selection = new Selection(pos, pos)
          }
        }
      }
    })
    return panel
  }

  protected static async getInput(placeHolder: string) {
    let name = await window.showInputBox({ placeHolder: placeHolder.replace(/\s\s+/g, ' ').trim() });
    name = name == undefined ? '' : name;
    // if (name.length == 0) {
    //     window.showErrorMessage('Invalid ' + placeHolder);
    //     return '';
    // }
    return name;
  }

  protected static async getListInput(placeHolder: string, list: string[]) {
    let name = await window.showQuickPick(list, { placeHolder: placeHolder });
    name = name == undefined ? '' : name;
    return name;
  }

  protected static async getYesNo(placeHolder: string): Promise<boolean> {
    let value = await window.showQuickPick(['Yes', 'No'], { placeHolder: placeHolder });
    return value.toLowerCase() == 'yes' ? true : false;
  }

  protected static async showMessage(message: string) {
    window.showInformationMessage(message);
    return true;
  }

  protected static async showError(message: string, consoleErr = null) {
    window.showErrorMessage(message);
    if (consoleErr !== null) {
      console.error(consoleErr + ' (See output console for more details)');
    }
    return false;
  }

  protected static refreshFilesExplorer() {
    commands.executeCommand('workbench.files.action.refreshFilesExplorer')
  }

  protected static getCommandList(): Promise<Command[]> {
    return new Promise(resolve => {
      cp.exec(`list --format=json`, (err, stdout) => {
        let commands: any[] = JSON.parse(stdout).commands
        let commandList: Command[] = []
        commands.forEach(command => {
          let commandItem = { name: command.name, description: command.description, options: [], arguments: [] }
          for (let i in command.definition.options) {
            if (['help', 'quiet', 'verbose', 'version', 'ansi', 'no-ansi', 'no-interaction', 'env'].indexOf(i) > -1) continue
            commandItem.options.push(command.definition.options[i])
          }
          for (let i in command.definition.arguments) {
            commandItem.arguments.push(command.definition.arguments[i])
          }
          commandList.push(commandItem)
        })
        resolve(commandList)
      })
    })
  }
}