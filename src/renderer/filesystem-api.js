import {ipcRenderer} from 'electron';

const getBasename = path => {
    const match = path.match(/([^/\\]+)$/);
    if (!match) return null;
    return match[1];
};

const readAsArrayBuffer = blob => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('cannot read'));
    fr.readAsArrayBuffer(blob);
});

class WrappedFileWritable {
    constructor (path) {
        this.path = path;
    }

    async write (content) {
        if (content instanceof Blob) {
            const arrayBuffer = await readAsArrayBuffer(content);
            console.log(`write ${this.path}`);
            await ipcRenderer.invoke('write-file', this.path, Buffer.from(new Uint8Array(arrayBuffer)));
        }
    }

    async close () {
        // pass
    }
}

class WrappedFileHandle {
    constructor (path) {
        this.path = path;
        this.name = getBasename(this.path);
    }

    async getFile () {
        const data = await ipcRenderer.invoke('read-file', this.path);
        console.log(`read file ${this.path}`);
        return new File([data], this.name);
    }

    /* eslint-disable require-await */
    async createWritable () {
        return new WrappedFileWritable(this.path);
    }

    async queryPermission () {
        return 'granted';
    }

    async requestPermission () {
        return 'granted';
    }
    /* eslint-enable require-await */
}

class AbortError extends Error {
    constructor (message) {
        super(message);
        this.name = 'AbortError';
    }
}

const typesToFilterList = types => types.map(type => ({
    name: type.description,
    extensions: Object.values(type.accept)
        .flat()
        .map(i => i.substr(1))
}));

window.showSaveFilePicker = async options => {
    const result = await ipcRenderer.invoke('show-save-dialog', {
        filters: typesToFilterList(options.types),
        suggestedName: options.suggestedName
    });

    if (result.canceled) {
        throw new AbortError('Operation was cancelled by user.');
    }

    const filePath = result.filePath;
    return new WrappedFileHandle(filePath);
};

window.showOpenFilePicker = async options => {
    const result = await ipcRenderer.invoke('show-open-dialog', {
        filters: typesToFilterList(options.types)
    });

    if (result.canceled) {
        throw new AbortError('Operation was cancelled by user.');
    }

    const [filePath] = result.filePaths;
    return [new WrappedFileHandle(filePath)];
};
