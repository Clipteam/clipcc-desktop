/* eslint-disable no-undef,no-return-await */
const {ipcRenderer} = require('electron');
const axios = require('axios');
const Channel = require('broadcast-channel').BroadcastChannel;

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

class BroadcastChannel extends Channel {
    constructor (name) {
        super(name, {type: 'node'});
        this._postMessage = Channel.postMessage;
    }
    postMessage (message) {
        return super.postMessage({data: message});
    }
}

window.BroadcastChannel = BroadcastChannel;
window.opener = self;
