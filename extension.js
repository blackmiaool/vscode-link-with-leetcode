const vscode = require('vscode');
const {
    createSocketIo
} = require("./black-socket");

var WebSocketServer = require("ws").Server;

var wsserver = new WebSocketServer({
    port: 28374
});

const sockets = [];
const io = createSocketIo(wsserver);

const {
    Range,
    Position
} = vscode;

let editorSave;

function setValue(editor, content) {
    editor.edit(function (TextEditorEdit) {
        TextEditorEdit.replace(new Range(new Position(0, 0), new Position(100000, 100000)), content);
    });
}
vscode.workspace.onDidCloseTextDocument(function (TextDocument) {
    if (editorSave && editorSave.TextDocument === TextDocument) {
        editorSave = false;
    }
});

function getEditor(language, content, description) {
    return new Promise(function (resolve) {
        if (editorSave) {
            resolve(editorSave);
            return;
        }
        
        if (description&&vscode.workspace.getConfiguration('linkWithLeetcode').openDescription) {
            vscode.workspace.openTextDocument({
                language:'text',
                content:description,
            }).then((TextDocument) => {
                vscode.window.showTextDocument(TextDocument, vscode.ViewColumn.Two);
                   
            });
        }

        vscode.workspace.openTextDocument({
            language,
            content
        }).then((TextDocument) => {
            vscode.window.showTextDocument(TextDocument)
                .then(editor => {
                    editorSave = {
                        editor,
                        TextDocument
                    };
                    resolve(editorSave);
                });
        });
    })
}

io.on('connection', function (socket) {
    sockets.push(socket);
    let config;
    socket.on("create", function ({
        language,
        content,
        description,
        fullUpdate = false
    }, cb) {
        getEditor(language, content, description).then(function ({
            editor,
            TextDocument
        }) {
            setValue(editor, content);
            config = {
                language,
                content,
                fullUpdate,
                socket,
                TextDocument,
                editor
            };
            socket.config = config;
            cb && cb();
        });
    });
    socket.on('close', function (socket) {
        sockets.splice(sockets.indexOf(socket), 1);
    });
    socket.on("change", function ({
        content
    }) {
        if (!socket.config) {
            return;
        }
        setValue(socket.config.editor, content)
    });
});

function activate(context) {
    vscode.workspace.onDidChangeTextDocument(function (e) {
        sockets.forEach(function (socket) {
            socket.emit("change", e.document.getText());
        });
    });

    var disposable = vscode.commands.registerCommand('extension.linkWithLeetCode', function () {
        vscode.window.showInformationMessage(`link-with-leetcode's server is running, click 'Open in VS Code button to start linking'`);
    });

    context.subscriptions.push(disposable);
}
exports.activate = activate;

function deactivate() { }
exports.deactivate = deactivate;
