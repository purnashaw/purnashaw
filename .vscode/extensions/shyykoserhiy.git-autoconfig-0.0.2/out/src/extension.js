'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const git_1 = require("./git/git");
const config_1 = require("./config/config");
const consts_1 = require("./consts");
const MESSAGE_PREFIX = "git-autoconfig: ";
let timeoutId;
// this method is called when your extension is activated
// extension is activated the very first time the command is executed
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const gitConf = yield git_1.findGit(undefined);
        const git = new git_1.Git({ gitPath: gitConf.path, version: gitConf.version });
        /**
         * Check for local config.
         */
        const checkForLocalConfig = () => __awaiter(this, void 0, void 0, function* () {
            const repositoryRoot = yield findRepositoryRoot(false);
            const repository = new git_1.Repository(git, repositoryRoot);
            try {
                // return early if the root is in ignore list 
                if (config_1.isRootInIgnoreList(repositoryRoot)) {
                    return;
                }
                if (repositoryRoot) {
                    const gitConfig = yield getGitConfig(repository, false);
                    if (!gitConfig) {
                        console.log(`${MESSAGE_PREFIX}Config doesn exists.`);
                        yield setGitConfig();
                    }
                    else {
                        console.log(`${MESSAGE_PREFIX}Config already exists. : ${JSON.stringify(gitConfig, null, 2)}`);
                    }
                }
                else {
                    console.log(`${MESSAGE_PREFIX}Failed to get repository root.`);
                }
            }
            catch (_ignorred) {
                console.log(`${MESSAGE_PREFIX}Error while trying to checkForLocalConfig. ${JSON.stringify(_ignorred)}`);
            }
            finally {
                timeoutId = setTimeout(checkForLocalConfig, config_1.getConfigQueryInterval());
            }
        });
        timeoutId = setTimeout(checkForLocalConfig, 0);
        /**
         * Finds repositoryRoot by vscode.workspace.rootPath
         * @param showError if to show  error messages
         */
        const findRepositoryRoot = (showError = true) => __awaiter(this, void 0, void 0, function* () {
            let repositoryRoot;
            try {
                repositoryRoot = yield git.getRepositoryRoot(vscode.workspace.rootPath);
            }
            catch (e) {
                if (showError) {
                    let errorMessage = `${MESSAGE_PREFIX}Failed to get git repository root.`;
                    if (e instanceof git_1.GitError) {
                        errorMessage += e.gitErrorCode;
                    }
                    vscode.window.showWarningMessage(errorMessage);
                }
                return null;
            }
            return repositoryRoot;
        });
        /**
         * Gets config git config from git repository(local)
         * @param repository git repository
         * @param showMessages if to show info and error messages
         */
        const getGitConfig = (repository, showMessages = true) => __awaiter(this, void 0, void 0, function* () {
            try {
                const userEmail = (yield repository.configGet('local', 'user.email', {})).trim();
                const userName = (yield repository.configGet('local', 'user.name', {})).trim();
                showMessages && vscode.window.showInformationMessage(`${MESSAGE_PREFIX}user.email=${userEmail} user.name=${userName}`);
                const result = { "user.email": userEmail, "user.name": userName };
                return result;
            }
            catch (e) {
                showMessages && vscode.window.showWarningMessage(`${MESSAGE_PREFIX}user.email or user.name is not set locally. You can set it using command '' `);
            }
            return null;
        });
        const ignoreCurrentRoot = () => __awaiter(this, void 0, void 0, function* () {
            const repositoryRoot = yield findRepositoryRoot();
            if (!repositoryRoot) {
                return;
            }
            yield config_1.addRootToIgnoreList(repositoryRoot);
        });
        const unignoreCurrentRoot = () => __awaiter(this, void 0, void 0, function* () {
            const repositoryRoot = yield findRepositoryRoot();
            if (!repositoryRoot) {
                return;
            }
            yield config_1.removeRootFromIgnoreList(repositoryRoot);
        });
        const setGitConfig = () => __awaiter(this, void 0, void 0, function* () {
            const repositoryRoot = yield findRepositoryRoot();
            if (!repositoryRoot) {
                return;
            }
            const repository = new git_1.Repository(git, repositoryRoot);
            const configList = config_1.getConfigList();
            const setGitConfig = (newConfig) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const newConfigKey = config_1.generateGitConfigKey(newConfig);
                    if (!configList.find((c) => config_1.generateGitConfigKey(c) === newConfigKey)) {
                        configList.push(newConfig);
                        yield config_1.updateConfigList(configList);
                    }
                    ;
                    yield repository.config('local', 'user.email', newConfig['user.email']);
                    yield repository.config('local', 'user.name', newConfig['user.name']);
                }
                catch (e) {
                    vscode.window.showErrorMessage('Failed to set local git config.', e);
                    return false;
                }
                vscode.window.showInformationMessage('Local git config successfully set.');
                return true;
            });
            const customSetGitConfig = () => __awaiter(this, void 0, void 0, function* () {
                const userEmail = yield vscode.window.showInputBox({ ignoreFocusOut: true, placeHolder: 'user.email like : "Marvolo@Riddle.Tom"', prompt: 'Enter email that you use for your git account.' });
                if (!userEmail) {
                    vscode.window.showInformationMessage('user.email should not be empty');
                }
                const userName = yield vscode.window.showInputBox({ ignoreFocusOut: true, placeHolder: 'user.name like : "Tom Marvolo Riddle"', prompt: 'Enter name that you use for your git account.' });
                const newConfig = {
                    "user.email": userEmail,
                    "user.name": userName
                };
                yield setGitConfig(newConfig);
            });
            if (configList.length) {
                const map = configList.concat(config_1.CUSTOM_GIT_CONFIG, config_1.IGNORE_CURRENT_ROOT_GIT_CONFIG).reduce((map, c) => {
                    map.set(config_1.generateGitConfigKey(c), c);
                    return map;
                }, new Map());
                const pick = yield vscode.window.showQuickPick(Array.from(map.keys()), { ignoreFocusOut: true, placeHolder: 'Select one of previous configs or new custom one or ignore current root.' });
                if (pick === config_1.generateGitConfigKey(config_1.CUSTOM_GIT_CONFIG)) {
                    yield customSetGitConfig();
                }
                else if (pick === config_1.generateGitConfigKey(config_1.IGNORE_CURRENT_ROOT_GIT_CONFIG)) {
                    yield vscode.commands.executeCommand(consts_1.COMMAND_IGNORE_ROOT);
                }
                else {
                    yield setGitConfig(map.get(pick));
                }
            }
            else {
                yield customSetGitConfig();
            }
        });
        //commands
        const getConfigCommand = vscode.commands.registerCommand(consts_1.COMMAND_GET_CONFIG, () => __awaiter(this, void 0, void 0, function* () {
            const repositoryRoot = yield findRepositoryRoot();
            if (!repositoryRoot) {
                return;
            }
            const repository = new git_1.Repository(git, repositoryRoot);
            getGitConfig(repository);
        }));
        const setConfigCommand = vscode.commands.registerCommand(consts_1.COMMAND_SET_CONFIG, () => __awaiter(this, void 0, void 0, function* () {
            yield setGitConfig();
        }));
        const ignoreRootCommand = vscode.commands.registerCommand(consts_1.COMMAND_IGNORE_ROOT, () => __awaiter(this, void 0, void 0, function* () {
            yield ignoreCurrentRoot();
        }));
        const unignoreRootCommand = vscode.commands.registerCommand(consts_1.COMMAND_UNIGNORE_ROOT, () => __awaiter(this, void 0, void 0, function* () {
            yield unignoreCurrentRoot();
        }));
        context.subscriptions.push(getConfigCommand, setConfigCommand, ignoreRootCommand, unignoreRootCommand);
    });
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    clearTimeout(timeoutId);
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map