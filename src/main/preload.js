/* eslint-disable no-undef,no-return-await */
const {ipcRenderer} = require('electron');
const axios = require('axios');

window.ClipCC = {
    addExtension: async url => {
        const content = await axios.get(url, {responseType: 'arraybuffer'});
        await ipcRenderer.invoke('load-extension', content.data);
    },
    getInstalledExtension: async () => {
        await ipcRenderer.invoke('get-extension');
        const extension = await ipcRenderer.invoke('get-extension');
        return extension;
    },
    ipc: {
        send (...args) {
            return ipcRenderer.send(...args);
        },
        invoke (...args) {
            return ipcRenderer.invoke(...args);
        },
        on (...args) {
            return ipcRenderer.on(...args);
        },
        once (...args) {
            return ipcRenderer.once(...args);
        }
    },
    versions: process.versions,
    system: {
        arch: process.arch,
        platform: process.platform
    }
};
