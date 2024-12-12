/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
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
exports.Repository = exports.Git = exports.GitErrorCodes = exports.GitError = exports.exec = exports.findGit = exports.RefType = exports.toDisposable = exports.dispose = exports.denodeify = void 0;
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const vscode_1 = require("vscode");
function denodeify(fn) {
    return (...args) => new Promise((c, e) => fn(...args, (err, r) => err ? e(err) : c(r)));
}
exports.denodeify = denodeify;
function dispose(disposables) {
    disposables.forEach(d => d.dispose());
    return [];
}
exports.dispose = dispose;
function toDisposable(dispose) {
    return { dispose };
}
exports.toDisposable = toDisposable;
const readdir = denodeify(fs.readdir);
const readfile = denodeify(fs.readFile);
var RefType;
(function (RefType) {
    RefType[RefType["Head"] = 0] = "Head";
    RefType[RefType["RemoteHead"] = 1] = "RemoteHead";
    RefType[RefType["Tag"] = 2] = "Tag";
})(RefType = exports.RefType || (exports.RefType = {}));
function parseVersion(raw) {
    return raw.replace(/^git version /, '');
}
function findSpecificGit(path) {
    return new Promise((c, e) => {
        const buffers = [];
        const child = cp.spawn(path, ['--version']);
        child.stdout.on('data', (b) => buffers.push(b));
        child.on('error', e);
        child.on('exit', code => code ? e(new Error('Not found')) : c({ path, version: parseVersion(Buffer.concat(buffers).toString('utf8').trim()) }));
    });
}
function findGitDarwin() {
    return new Promise((c, e) => {
        cp.exec('which git', (err, gitPathBuffer) => {
            if (err) {
                return e('git not found');
            }
            const path = gitPathBuffer.toString().replace(/^\s+|\s+$/g, '');
            function getVersion(path) {
                // make sure git executes
                cp.exec('git --version', (err, stdout) => {
                    if (err) {
                        return e('git not found');
                    }
                    return c({ path, version: parseVersion(stdout.toString('utf8').trim()) });
                });
            }
            if (path !== '/usr/bin/git') {
                return getVersion(path);
            }
            // must check if XCode is installed
            cp.exec('xcode-select -p', (err) => {
                if (err && err.code === 2) {
                    // git is not installed, and launching /usr/bin/git
                    // will prompt the user to install it
                    return e('git not found');
                }
                getVersion(path);
            });
        });
    });
}
function findSystemGitWin32(base) {
    if (!base) {
        return Promise.reject('Not found');
    }
    return findSpecificGit(path.join(base, 'Git', 'cmd', 'git.exe'));
}
function findGitHubGitWin32() {
    const github = path.join(process.env['LOCALAPPDATA'], 'GitHub');
    return readdir(github).then(children => {
        const git = children.filter(child => /^PortableGit/.test(child))[0];
        if (!git) {
            return Promise.reject('Not found');
        }
        return findSpecificGit(path.join(github, git, 'cmd', 'git.exe'));
    });
}
function findGitWin32() {
    return findSystemGitWin32(process.env['ProgramW6432'])
        .then(void 0, () => findSystemGitWin32(process.env['ProgramFiles(x86)']))
        .then(void 0, () => findSystemGitWin32(process.env['ProgramFiles']))
        .then(void 0, () => findSpecificGit('git'))
        .then(void 0, () => findGitHubGitWin32());
}
function findGit(hint) {
    var first = hint ? findSpecificGit(hint) : Promise.reject(null);
    return first.then(void 0, () => {
        switch (process.platform) {
            case 'darwin': return findGitDarwin();
            case 'win32': return findGitWin32();
            default: return findSpecificGit('git');
        }
    });
}
exports.findGit = findGit;
function exec(child) {
    return __awaiter(this, void 0, void 0, function* () {
        const disposables = [];
        const once = (ee, name, fn) => {
            ee.once(name, fn);
            disposables.push(toDisposable(() => ee.removeListener(name, fn)));
        };
        const on = (ee, name, fn) => {
            ee.on(name, fn);
            disposables.push(toDisposable(() => ee.removeListener(name, fn)));
        };
        const [exitCode, stdout, stderr] = yield Promise.all([
            new Promise((c, e) => {
                once(child, 'error', e);
                once(child, 'exit', c);
            }),
            new Promise(c => {
                const buffers = [];
                on(child.stdout, 'data', (b) => buffers.push(b));
                once(child.stdout, 'close', () => c(buffers.join('')));
            }),
            new Promise(c => {
                const buffers = [];
                on(child.stderr, 'data', (b) => buffers.push(b));
                once(child.stderr, 'close', () => c(buffers.join('')));
            })
        ]);
        dispose(disposables);
        return { exitCode, stdout, stderr };
    });
}
exports.exec = exec;
class GitError {
    constructor(data) {
        if (data.error) {
            this.error = data.error;
            this.message = data.error.message;
        }
        else {
            this.error = void 0;
        }
        this.message = this.message || data.message || 'Git error';
        this.stdout = data.stdout;
        this.stderr = data.stderr;
        this.exitCode = data.exitCode;
        this.gitErrorCode = data.gitErrorCode;
        this.gitCommand = data.gitCommand;
    }
    toString() {
        let result = this.message + ' ' + JSON.stringify({
            exitCode: this.exitCode,
            gitErrorCode: this.gitErrorCode,
            gitCommand: this.gitCommand,
            stdout: this.stdout,
            stderr: this.stderr
        }, [], 2);
        if (this.error) {
            result += this.error.stack;
        }
        return result;
    }
}
exports.GitError = GitError;
exports.GitErrorCodes = {
    BadConfigFile: 'BadConfigFile',
    AuthenticationFailed: 'AuthenticationFailed',
    NoUserNameConfigured: 'NoUserNameConfigured',
    NoUserEmailConfigured: 'NoUserEmailConfigured',
    NoRemoteRepositorySpecified: 'NoRemoteRepositorySpecified',
    NotAGitRepository: 'NotAGitRepository',
    NotAtRepositoryRoot: 'NotAtRepositoryRoot',
    Conflict: 'Conflict',
    UnmergedChanges: 'UnmergedChanges',
    PushRejected: 'PushRejected',
    RemoteConnectionError: 'RemoteConnectionError',
    DirtyWorkTree: 'DirtyWorkTree',
    CantOpenResource: 'CantOpenResource',
    GitNotFound: 'GitNotFound',
    CantCreatePipe: 'CantCreatePipe',
    CantAccessRemote: 'CantAccessRemote',
    RepositoryNotFound: 'RepositoryNotFound'
};
class Git {
    constructor(options) {
        this._onOutput = new vscode_1.EventEmitter();
        this.gitPath = options.gitPath;
        this.version = options.version;
    }
    get onOutput() { return this._onOutput.event; }
    open(repository, env = {}) {
        return new Repository(this, repository, env);
    }
    getRepositoryRoot(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.exec(path, ['rev-parse', '--show-toplevel']);
            return result.stdout.trim();
        });
    }
    exec(cwd, args, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            options = Object.assign({ cwd }, options || {});
            return yield this._exec(args, options);
        });
    }
    stream(cwd, args, options = {}) {
        options = Object.assign({ cwd }, options || {});
        return this.spawn(args, options);
    }
    _exec(args, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const child = this.spawn(args, options);
            if (options.input) {
                child.stdin.end(options.input, 'utf8');
            }
            const result = yield exec(child);
            if (result.exitCode) {
                let gitErrorCode = void 0;
                if (/Authentication failed/.test(result.stderr)) {
                    gitErrorCode = exports.GitErrorCodes.AuthenticationFailed;
                }
                else if (/Not a git repository/.test(result.stderr)) {
                    gitErrorCode = exports.GitErrorCodes.NotAGitRepository;
                }
                else if (/bad config file/.test(result.stderr)) {
                    gitErrorCode = exports.GitErrorCodes.BadConfigFile;
                }
                else if (/cannot make pipe for command substitution|cannot create standard input pipe/.test(result.stderr)) {
                    gitErrorCode = exports.GitErrorCodes.CantCreatePipe;
                }
                else if (/Repository not found/.test(result.stderr)) {
                    gitErrorCode = exports.GitErrorCodes.RepositoryNotFound;
                }
                else if (/unable to access/.test(result.stderr)) {
                    gitErrorCode = exports.GitErrorCodes.CantAccessRemote;
                }
                if (options.log !== false) {
                    this.log(`${result.stderr}\n`);
                }
                return Promise.reject(new GitError({
                    message: 'Failed to execute git',
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: result.exitCode,
                    gitErrorCode,
                    gitCommand: args[0]
                }));
            }
            return result;
        });
    }
    spawn(args, options = {}) {
        if (!this.gitPath) {
            throw new Error('git could not be found in the system.');
        }
        if (!options) {
            options = {};
        }
        if (!options.stdio && !options.input) {
            options.stdio = ['ignore', null, null]; // Unless provided, ignore stdin and leave default streams for stdout and stderr
        }
        options.env = Object.assign({}, process.env, options.env || {}, {
            VSCODE_GIT_COMMAND: args[0],
            LANG: 'en_US.UTF-8'
        });
        if (options.log !== false) {
            this.log(`git ${args.join(' ')}\n`);
        }
        return cp.spawn(this.gitPath, args, options);
    }
    log(output) {
        this._onOutput.fire(output);
    }
}
exports.Git = Git;
class Repository {
    constructor(_git, repositoryRoot, env = {}) {
        this._git = _git;
        this.repositoryRoot = repositoryRoot;
        this.env = env;
    }
    get git() {
        return this._git;
    }
    get root() {
        return this.repositoryRoot;
    }
    exec(args, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            options.env = Object.assign({}, options.env || {});
            options.env = Object.assign(options.env, this.env);
            return yield this.git.exec(this.repositoryRoot, args, options);
        });
    }
    configGet(scope, key, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['config'];
            if (scope) {
                args.push(`--${scope}`);
            }
            args.push('--get');
            args.push(key);
            const result = yield this.exec(args, options);
            return result.stdout;
        });
    }
    config(scope, key, value, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const args = ['config'];
            if (scope) {
                args.push(`--${scope}`);
            }
            args.push(key);
            if (value) {
                args.push(value);
            }
            const result = yield this.exec(args, options);
            return result.stdout;
        });
    }
    getStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const executionResult = yield this.exec(['status', '-z', '-u']);
            const status = executionResult.stdout;
            const result = [];
            let current;
            let i = 0;
            function readName() {
                const start = i;
                let c;
                while ((c = status.charAt(i)) !== '\u0000') {
                    i++;
                }
                return status.substring(start, i++);
            }
            while (i < status.length) {
                current = {
                    x: status.charAt(i++),
                    y: status.charAt(i++),
                    path: ''
                };
                i++;
                if (current.x === 'R') {
                    current.rename = readName();
                }
                current.path = readName();
                // If path ends with slash, it must be a nested git repo
                if (current.path[current.path.length - 1] === '/') {
                    continue;
                }
                result.push(current);
            }
            return result;
        });
    }
}
exports.Repository = Repository;
//# sourceMappingURL=git.js.map