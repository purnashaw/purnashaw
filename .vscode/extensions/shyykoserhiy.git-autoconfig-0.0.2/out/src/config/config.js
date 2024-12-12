"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConfigList = exports.getConfigList = exports.generateGitConfigKey = exports.isRootInIgnoreList = exports.removeRootFromIgnoreList = exports.addRootToIgnoreList = exports.setIgnoreRootList = exports.getIgnoreRootList = exports.getConfigQueryInterval = exports.getConfig = exports.IGNORE_CURRENT_ROOT_GIT_CONFIG = exports.CUSTOM_GIT_CONFIG = void 0;
const vscode_1 = require("vscode");
exports.CUSTOM_GIT_CONFIG = {
    "user.name": "custom",
    "user.email": ""
};
exports.IGNORE_CURRENT_ROOT_GIT_CONFIG = {
    "user.name": "Ignore current root",
    "user.email": ""
};
const CONFIG_LIST_KEY = 'configList';
const IGNORE_LIST_KEY = 'ignoreRootList';
function getConfig() {
    return vscode_1.workspace.getConfiguration('git-autoconfig');
}
exports.getConfig = getConfig;
function getConfigQueryInterval() {
    return getConfig().get('queryInterval');
}
exports.getConfigQueryInterval = getConfigQueryInterval;
function getIgnoreRootList() {
    return getConfig().get(IGNORE_LIST_KEY, []);
}
exports.getIgnoreRootList = getIgnoreRootList;
function setIgnoreRootList(ignoreRootList) {
    return getConfig().update(IGNORE_LIST_KEY, ignoreRootList, true);
}
exports.setIgnoreRootList = setIgnoreRootList;
function addRootToIgnoreList(root) {
    return setIgnoreRootList(Array.from(new Set([...getIgnoreRootList(), root])));
}
exports.addRootToIgnoreList = addRootToIgnoreList;
function removeRootFromIgnoreList(root) {
    return setIgnoreRootList(Array.from(new Set([...getIgnoreRootList().filter((r) => {
            return r !== root;
        })])));
}
exports.removeRootFromIgnoreList = removeRootFromIgnoreList;
function isRootInIgnoreList(root) {
    return getIgnoreRootList().indexOf(root) >= 0;
}
exports.isRootInIgnoreList = isRootInIgnoreList;
function generateGitConfigKey(c) {
    return `${c["user.email"]} ${c["user.name"]}`;
}
exports.generateGitConfigKey = generateGitConfigKey;
function getConfigList() {
    return getConfig().get(CONFIG_LIST_KEY);
}
exports.getConfigList = getConfigList;
function updateConfigList(configList) {
    return getConfig().update(CONFIG_LIST_KEY, configList, true);
}
exports.updateConfigList = updateConfigList;
//# sourceMappingURL=config.js.map