import {BrowserWindow, Menu, app, dialog, ipcMain, shell, systemPreferences} from 'electron';
import fs from 'fs-extra';
import path from 'path';
import {URL} from 'url';
import {promisify} from 'util';

import argv from './argv';
import {getFilterForExtension} from './FileFilters';
import telemetry from './ScratchDesktopTelemetry';
import MacOSMenu from './MacOSMenu';
import log from '../common/log.js';
import {productName, version} from '../../package.json';

// suppress deprecation warning; this will be the default in Electron 9
app.allowRendererProcessReuse = true;

telemetry.appWasOpened();

// const defaultSize = {width: 1096, height: 715}; // minimum
const defaultSize = {width: 1280, height: 800}; // good for MAS screenshots

const isDevelopment = process.env.NODE_ENV !== 'production';

const devToolKey = ((process.platform === 'darwin') ?
    { // macOS: command+option+i
        alt: true, // option
        control: false,
        meta: true, // command
        shift: false,
        code: 'KeyI'
    } : { // Windows: control+shift+i
        alt: false,
        control: true,
        meta: false, // Windows key
        shift: true,
        code: 'KeyI'
    }
);

// global window references prevent them from being garbage-collected
const _windows = {};

// enable connecting to Scratch Link even if we DNS / Internet access is not available
// this must happen BEFORE the app ready event!
app.commandLine.appendSwitch('host-resolver-rules', 'MAP device-manager.scratch.mit.edu 127.0.0.1');

const displayPermissionDeniedWarning = (browserWindow, permissionType) => {
    let title;
    let message;
    switch (permissionType) {
    case 'camera':
        title = 'Camera Permission Denied';
        message = 'Permission to use the camera has been denied. ' +
            'Scratch will not be able to take a photo or use video sensing blocks.';
        break;
    case 'microphone':
        title = 'Microphone Permission Denied';
        message = 'Permission to use the microphone has been denied. ' +
            'Scratch will not be able to record sounds or detect loudness.';
        break;
    default: // shouldn't ever happen...
        title = 'Permission Denied';
        message = 'A permission has been denied.';
    }

    let instructions;
    switch (process.platform) {
    case 'darwin':
        instructions = 'To change Scratch permissions, please check "Security & Privacy" in System Preferences.';
        break;
    default:
        instructions = 'To change Scratch permissions, please check your system settings and restart Scratch.';
        break;
    }
    message = `${message}\n\n${instructions}`;

    dialog.showMessageBox(browserWindow, {type: 'warning', title, message});
};

/**
 * Build an absolute URL from a relative one, optionally adding search query parameters.
 * The base of the URL will depend on whether or not the application is running in development mode.
 * @param {string} url - the relative URL, like 'index.html'
 * @param {*} search - the optional "search" parameters (the part of the URL after '?'), like "route=about"
 * @returns {string} - an absolute URL as a string
 */
const makeFullUrl = (url, search = null) => {
    const baseUrl = (isDevelopment ?
        `http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}/` :
        `file://${__dirname}/`
    );
    const fullUrl = new URL(url, baseUrl);
    if (search) {
        fullUrl.search = search; // automatically percent-encodes anything that needs it
    }
    return fullUrl.toString();
};

/**
 * Prompt in a platform-specific way for permission to access the microphone or camera, if Electron supports doing so.
 * Any application-level checks, such as whether or not a particular frame or document should be allowed to ask,
 * should be done before calling this function.
 * This function may return a Promise!
 *
 * @param {string} mediaType - one of Electron's media types, like 'microphone' or 'camera'
 * @returns {boolean|Promise.<boolean>} - true if permission granted, false otherwise.
 */
const askForMediaAccess = mediaType => {
    if (systemPreferences.askForMediaAccess) {
        // Electron currently only implements this on macOS
        // This returns a Promise
        return systemPreferences.askForMediaAccess(mediaType);
    }
    // For other platforms we can't reasonably do anything other than assume we have access.
    return true;
};

const handlePermissionRequest = async (webContents, permission, callback, details) => {
    if (webContents !== _windows.main.webContents) {
        // deny: request came from somewhere other than the main window's web contents
        return callback(false);
    }
    if (!details.isMainFrame) {
        // deny: request came from a subframe of the main window, not the main frame
        return callback(false);
    }
    if (permission !== 'media') {
        // deny: request is for some other kind of access like notifications or pointerLock
        return callback(false);
    }
    const requiredBase = makeFullUrl('');
    if (details.requestingUrl.indexOf(requiredBase) !== 0) {
        // deny: request came from a URL outside of our "sandbox"
        return callback(false);
    }
    let askForMicrophone = false;
    let askForCamera = false;
    for (const mediaType of details.mediaTypes) {
        switch (mediaType) {
        case 'audio':
            askForMicrophone = true;
            break;
        case 'video':
            askForCamera = true;
            break;
        default:
            // deny: unhandled media type
            return callback(false);
        }
    }
    const parentWindow = _windows.main; // if we ever allow media in non-main windows we'll also need to change this
    if (askForMicrophone) {
        const microphoneResult = await askForMediaAccess('microphone');
        if (!microphoneResult) {
            displayPermissionDeniedWarning(parentWindow, 'microphone');
            return callback(false);
        }
    }
    if (askForCamera) {
        const cameraResult = await askForMediaAccess('camera');
        if (!cameraResult) {
            displayPermissionDeniedWarning(parentWindow, 'camera');
            return callback(false);
        }
    }
    return callback(true);
};

const createWindow = ({search = null, url = 'index.html', ...browserWindowOptions}) => {
    const window = new BrowserWindow({
        useContentSize: true,
        show: false,
        webPreferences: {
            nodeIntegration: true
        },
        ...browserWindowOptions
    });
    const webContents = window.webContents;

    webContents.session.setPermissionRequestHandler(handlePermissionRequest);

    webContents.on('before-input-event', (event, input) => {
        if (input.code === devToolKey.code &&
            input.alt === devToolKey.alt &&
            input.control === devToolKey.control &&
            input.meta === devToolKey.meta &&
            input.shift === devToolKey.shift &&
            input.type === 'keyDown' &&
            !input.isAutoRepeat &&
            !input.isComposing) {
            event.preventDefault();
            webContents.openDevTools({mode: 'detach', activate: true});
        }
    });

    webContents.on('new-window', (event, newWindowUrl) => {
        shell.openExternal(newWindowUrl);
        event.preventDefault();
    });

    const fullUrl = makeFullUrl(url, search);
    window.loadURL(fullUrl);
    window.once('ready-to-show', () => {
        webContents.send('ready-to-show');
    });

    return window;
};

const createAboutWindow = () => {
    const window = createWindow({
        width: 400,
        height: 400,
        parent: _windows.main,
        search: 'route=about',
        title: `About ${productName}`
    });
    return window;
};

const createPrivacyWindow = () => {
    const window = createWindow({
        width: _windows.main.width * 0.8,
        height: _windows.main.height * 0.8,
        parent: _windows.main,
        search: 'route=privacy',
        title: `${productName} Privacy Policy`
    });
    return window;
};

const getIsProjectSave = downloadItem => {
    switch (downloadItem.getMimeType()) {
    case 'application/x.scratch.sb3':
        return true;
    }
    return false;
};

const createMainWindow = () => {
    const window = createWindow({
        width: defaultSize.width,
        height: defaultSize.height,
        title: `${productName} ${version}` // something like "Scratch 3.14"
    });
    const webContents = window.webContents;

    webContents.session.on('will-download', (willDownloadEvent, downloadItem) => {
        const isProjectSave = getIsProjectSave(downloadItem);
        const itemPath = downloadItem.getFilename();
        const baseName = path.basename(itemPath);
        const extName = path.extname(baseName);
        const options = {
            defaultPath: baseName
        };
        if (extName) {
            const extNameNoDot = extName.replace(/^\./, '');
            options.filters = [getFilterForExtension(extNameNoDot)];
        }
        const userChosenPath = dialog.showSaveDialogSync(window, options);
        // this will be falsy if the user canceled the save
        if (userChosenPath) {
            const userBaseName = path.basename(userChosenPath);
            const tempPath = path.join(app.getPath('temp'), userBaseName);

            // WARNING: `setSavePath` on this item is only valid during the `will-download` event. Calling the async
            // version of `showSaveDialog` means the event will finish before we get here, so `setSavePath` will be
            // ignored. For that reason we need to call `showSaveDialogSync` above.
            downloadItem.setSavePath(tempPath);

            downloadItem.on('done', async (doneEvent, doneState) => {
                try {
                    if (doneState !== 'completed') {
                        // The download was canceled or interrupted. Cancel the telemetry event and delete the file.
                        throw new Error(`save ${doneState}`); // "save cancelled" or "save interrupted"
                    }
                    await fs.move(tempPath, userChosenPath, {overwrite: true});
                    if (isProjectSave) {
                        const newProjectTitle = path.basename(userChosenPath, extName);
                        webContents.send('setTitleFromSave', {title: newProjectTitle});

                        // "setTitleFromSave" will set the project title but GUI has already reported the telemetry
                        // event using the old title. This call lets the telemetry client know that the save was
                        // actually completed and the event should be committed to the event queue with this new title.
                        telemetry.projectSaveCompleted(newProjectTitle);
                    }
                } catch (e) {
                    if (isProjectSave) {
                        telemetry.projectSaveCanceled();
                    }
                    // don't clean up until after the message box to allow troubleshooting / recovery
                    await dialog.showMessageBox(window, {
                        type: 'error',
                        message: `Save failed:\n${userChosenPath}`,
                        detail: e.message
                    });
                    fs.exists(tempPath).then(exists => {
                        if (exists) {
                            fs.unlink(tempPath);
                        }
                    });
                }
            });
        } else {
            downloadItem.cancel();
            if (isProjectSave) {
                telemetry.projectSaveCanceled();
            }
        }
    });

    webContents.on('will-prevent-unload', ev => {
        const choice = dialog.showMessageBoxSync(window, {
            type: 'question',
            message: 'Leave Scratch?',
            detail: 'Any unsaved changes will be lost.',
            buttons: ['Stay', 'Leave'],
            cancelId: 0, // closing the dialog means "stay"
            defaultId: 0 // pressing enter or space without explicitly selecting something means "stay"
        });
        const shouldQuit = (choice === 1);
        if (shouldQuit) {
            ev.preventDefault();
        }
    });

    window.once('ready-to-show', () => {
        window.show();
    });

    return window;
};

if (process.platform === 'darwin') {
    const osxMenu = Menu.buildFromTemplate(MacOSMenu(app));
    Menu.setApplicationMenu(osxMenu);
} else {
    // disable menu for other platforms
    Menu.setApplicationMenu(null);
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
    app.quit();
});

app.on('will-quit', () => {
    telemetry.appWillClose();
});

// work around https://github.com/MarshallOfSound/electron-devtools-installer/issues/122
// which seems to be a result of https://github.com/electron/electron/issues/19468
if (process.platform === 'win32') {
    const appUserDataPath = app.getPath('userData');
    const devToolsExtensionsPath = path.join(appUserDataPath, 'DevTools Extensions');
    try {
        fs.unlinkSync(devToolsExtensionsPath);
    } catch (_) {
        // don't complain if the file doesn't exist
    }
}

// create main BrowserWindow when electron is ready
app.on('ready', () => {
    if (isDevelopment) {
        import('electron-devtools-installer').then(importedModule => {
            const {default: installExtension, ...devToolsExtensions} = importedModule;
            const extensionsToInstall = [
                devToolsExtensions.REACT_DEVELOPER_TOOLS,
                devToolsExtensions.REACT_PERF,
                devToolsExtensions.REDUX_DEVTOOLS
            ];
            for (const extension of extensionsToInstall) {
                // WARNING: depending on a lot of things including the version of Electron `installExtension` might
                // return a promise that never resolves, especially if the extension is already installed.
                installExtension(extension).then(
                    extensionName => log(`Installed dev extension: ${extensionName}`),
                    errorMessage => log.error(`Error installing dev extension: ${errorMessage}`)
                );
            }
        });
    }

    _windows.main = createMainWindow();
    _windows.main.on('closed', () => {
        delete _windows.main;
    });
    _windows.about = createAboutWindow();
    _windows.about.on('close', event => {
        event.preventDefault();
        _windows.about.hide();
    });
    _windows.privacy = createPrivacyWindow();
    _windows.privacy.on('close', event => {
        event.preventDefault();
        _windows.privacy.hide();
    });
});

ipcMain.on('open-about-window', () => {
    _windows.about.show();
});

ipcMain.on('open-privacy-policy-window', () => {
    _windows.privacy.show();
});

// start loading initial project data before the GUI needs it so the load seems faster
const initialProjectDataPromise = (async () => {
    if (argv._.length === 0) {
        // no command line argument means no initial project data
        return;
    }
    if (argv._.length > 1) {
        log.warn(`Expected 1 command line argument but received ${argv._.length}.`);
    }
    const projectPath = argv._[argv._.length - 1];
    try {
        const projectData = await promisify(fs.readFile)(projectPath, null);
        return projectData;
    } catch (e) {
        dialog.showMessageBox(_windows.main, {
            type: 'error',
            title: 'Failed to load project',
            message: `Could not load project from file:\n${projectPath}`,
            detail: e.message
        });
    }
    // load failed: initial project data undefined
})(); // IIFE

ipcMain.handle('get-initial-project-data', () => initialProjectDataPromise);
