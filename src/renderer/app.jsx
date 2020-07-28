import {ipcRenderer, shell, remote} from 'electron';
import fs from 'fs';
import bindAll from 'lodash.bindall';
import React from 'react';
import ReactDOM from 'react-dom';
import {compose} from 'redux';
import GUI, {AppStateHOC} from 'clipcc-gui';

import ElectronStorageHelper from '../common/ElectronStorageHelper';

import styles from './app.css';

const defaultProjectId = 0;
const externalProjectId = -1;

// override window.open so that it uses the OS's default browser, not an electron browser
window.open = function (url, target) {
    if (target === '_blank') {
        shell.openExternal(url);
    }
};
// Register "base" page view
// analytics.pageview('/');

const appTarget = document.getElementById('app');
appTarget.className = styles.app || 'app'; // TODO
document.body.appendChild(appTarget);

GUI.setAppElement(appTarget);

const ScratchDesktopHOC = function (WrappedComponent) {
    class ScratchDesktopComponent extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'handleProjectTelemetryEvent',
                'handleSetTitleFromSave',
                'handleStorageInit',
                'handleTelemetryModalOptIn',
                'handleTelemetryModalOptOut',
                'handleUpdateProjectTitle',
                'handleVmInit',
                'handleRef'
            ]);
            this.state = {
                projectTitle: null
            };
        }
        componentDidMount () {
            ipcRenderer.on('setTitleFromSave', this.handleSetTitleFromSave);
        }
        componentWillUnmount () {
            ipcRenderer.removeListener('setTitleFromSave', this.handleSetTitleFromSave);
        }
        handleClickLogo () {
            ipcRenderer.send('open-about-window');
        }
        handleProjectTelemetryEvent (event, metadata) {
            ipcRenderer.send(event, metadata);
        }
        handleSetTitleFromSave (event, args) {
            this.handleUpdateProjectTitle(args.title);
        }
        handleStorageInit (storageInstance) {
            storageInstance.addHelper(new ElectronStorageHelper(storageInstance));
        }
        handleTelemetryModalOptIn () {
            ipcRenderer.send('setTelemetryDidOptIn', true);
        }
        handleTelemetryModalOptOut () {
            ipcRenderer.send('setTelemetryDidOptIn', false);
        }
        handleUpdateProjectTitle (newTitle) {
            this.setState({projectTitle: newTitle});
        }
        handleVmInit (vm) {
            const argv = remote.getGlobal('sharedObject').argv;
            if (argv.length > 1 && argv[1]) {
                this.gui.props.onLoadingStarted();
                fs.readFile(argv[1], (err, data) => {
                    if (err) {
                        this.gui.props.onLoadingFinished(this.gui.props.loadingState, false);
                    } else {
                        vm.loadProject(data)
                            .then(() => {
                                this.gui.props.onLoadingFinished(this.gui.props.loadingState, true);
                            })
                            .catch(error => {
                                console.warn(error);
                                this.gui.props.onLoadingFinished(this.gui.props.loadingState, false);
                            });
                    }
                });
            }
        }
        handleRef (gui) {
            this.gui = gui;
        }
        render () {
            const shouldLoadExternalProject = remote.getGlobal('sharedObject').argv.length > 1;
            const shouldShowTelemetryModal = (typeof ipcRenderer.sendSync('getTelemetryDidOptIn') !== 'boolean');
            return (<WrappedComponent
                canEditTitle
                isScratchDesktop
                projectId={shouldLoadExternalProject ? externalProjectId : defaultProjectId}
                projectTitle={this.state.projectTitle}
                showTelemetryModal={shouldShowTelemetryModal}
                onClickLogo={this.handleClickLogo}
                onProjectTelemetryEvent={this.handleProjectTelemetryEvent}
                onStorageInit={this.handleStorageInit}
                onTelemetryModalOptIn={this.handleTelemetryModalOptIn}
                onTelemetryModalOptOut={this.handleTelemetryModalOptOut}
                onUpdateProjectTitle={this.handleUpdateProjectTitle}
                onVmInit={this.handleVmInit}
                onRef={this.handleRef}
                {...this.props}
            />);
        }
    }

    return ScratchDesktopComponent;
};

// note that redux's 'compose' function is just being used as a general utility to make
// the hierarchy of HOC constructor calls clearer here; it has nothing to do with redux's
// ability to compose reducers.
const WrappedGui = compose(
    ScratchDesktopHOC,
    AppStateHOC
)(GUI);

ReactDOM.render(<WrappedGui />, appTarget);
