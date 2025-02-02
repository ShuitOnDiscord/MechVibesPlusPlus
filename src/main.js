// dependencies
// npm install howler@2.1.2
// npm install electron@6.1.5

// Modules to control application life and create native browser window
const { app, BrowserWindow, Tray, Menu, shell, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const StartupHandler = require('./utils/applicationjs/startup_handler.js');
const ListenHandler = require('./utils/applicationjs/listen_handler.js');
const KeyupHandler = require('./utils/applicationjs/keyup_handler.js');
const MouseHandler = require('./utils/applicationjs/mouse_handler.js');
const RandomHandler = require('./utils/applicationjs/random_handler.js');
const { title } = require('process');
const { Body } = require('node-fetch');

const SYSTRAY_ICON = path.join(__dirname, "./images/system-tray-icon.png");
const home_dir = app.getPath('home');
const keyboardcustom_dir = path.join(home_dir, './sounds/mechvibes_custom');
const mousecustom_dir = path.join(home_dir, './sounds/mousevibes_custom');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var win;
var tray = null;
global.app_version = app.getVersion();
global.keyboardcustom_dir = keyboardcustom_dir;
global.mousecustom_dir = mousecustom_dir;
// create custom sound folder if not exists
fs.ensureDirSync(keyboardcustom_dir);
fs.ensureDirSync(mousecustom_dir);

function createWindow(show = true) {
  // Create the browser window.
  win = new BrowserWindow({
    width: 450,
    height: 730,
    webSecurity: false,
    // resizable: false,
    // fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, './utils/pagejs/app.js'),
      contextIsolation: false,
      nodeIntegration: true,
    },
    show,
  });

  // remove menu bar
  // win.removeMenu();

  // and load the index.html of the app.
  win.loadFile(path.join(__dirname, "./pages/index.html"));

  // Emitted when the window is closed.
  win.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  win.on('minimize', function (event) {
    if (process.platform === 'darwin') {
      app.dock.hide();
    }
    event.preventDefault();
    win.hide();
  });

  win.on('close', function (event) {
    if (!app.isQuiting) {
      const hideNotif = new Notification({
        title:"Mechvibes++ is still running",
        body:"Mechvibes++ is still running. To close it, go through the system tray or settings",
        icon: path.join(__dirname, "./images/icon.png")
      });
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
      event.preventDefault();
      win.hide();
      hideNotif.show();
    }
    return false;
  });

  return win;
}

const gotTheLock = app.requestSingleInstanceLock();
app.on('second-instance', () => {
  // Someone tried to run a second instance, we should focus our window.
  if (win) {
    win.show();
    win.focus();
  }
});

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Don't show the window and create a tray instead
  // create and get window instance
  app.whenReady().then(() => {
    win = createWindow(true);

    // start tray icon
    tray = new Tray(SYSTRAY_ICON);

    // tray icon tooltip
    tray.setToolTip('MechvibesPlusPlus');

    const startup_handler = new StartupHandler(app);
    const listen_handler = new ListenHandler(app);
    const keyup_handler = new KeyupHandler(app);
    const mouse_handler = new MouseHandler(app);
    const random_handler = new RandomHandler(app);

    // context menu when hover on tray icon
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'MechvibesPlusPlus',
        click: function () {
          // show app on click
          win.show();
        },
      },
      {
        label: 'Editor',
        click: function () {
          openEditorWindow();
        },
      },
      {
        label: 'Keyboard Sound Custom Folder',
        click: function () {
          shell.openItem(keyboardcustom_dir);
        },
      },
      {
        label: 'Mouse Sound Custom Folder',
        click: function () {
          shell.openItem(mousecustom_dir);
        },
      },
      {
        label: 'Open Devtools',
        click: function () {
          win.openDevTools();
          win.webContents.openDevTools();
        },
      },
      {
        label: 'Refresh Soundpacks',
        click: function () {
          win.webContents.send('refresh')
        },
      },
      {
        label: 'Mute',
        type: 'checkbox',
        checked: listen_handler.is_muted,
        click: function () {
          listen_handler.toggle();
          win.webContents.send('muted', listen_handler.is_muted);
        },
      },
      {
      label: 'Keyup Sounds',
      type: 'checkbox',
      checked: keyup_handler.is_keyup,
      click: function () {
        keyup_handler.toggle();
        win.webContents.send('theKeyup', keyup_handler.is_keyup);
        },
      },
      {
        label: 'Mouse Sounds',
        type: 'checkbox',
        checked: mouse_handler.is_mousesounds,
        click: function () {
          mouse_handler.toggle();
          win.webContents.send('MouseSounds', mouse_handler.is_mousesounds);
        },
      },
      {
        label: 'Random Sounds',
        type: 'checkbox',
        checked: random_handler.is_random,
        click: function () {
          random_handler.toggle();
          win.webContents.send('RandomSoundEnable', random_handler.is_random);
        },
      },
      {
        label: 'Enable at Startup',
        type: 'checkbox',
        checked: startup_handler.is_enabled,
        click: function () {
          startup_handler.toggle();
        },
      },
      {
        label: 'Quit',
        click: function () {
          // quit
          app.isQuiting = true;
          app.quit();
        },
      },
    ]);

    // double click on tray icon, show the app
    tray.on('double-click', () => {
      win.show();
    });

    tray.setContextMenu(contextMenu);

    // prevent Electron app from interrupting macOS system shutdown
    if (process.platform == 'darwin') {
      const { powerMonitor } = require('electron');
      powerMonitor.on('shutdown', () => {
        app.quit();
      });
    }
  });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) createWindow();
});

// always be sure that your application handles the 'quit' event in your main process
app.on('quit', () => {
  app.quit();
});

var editor_window = null;

function openEditorWindow() {
  if (editor_window) {
    editor_window.focus();
    return;
  }

  editor_window = new BrowserWindow({
    width: 1200,
    height: 600,
    // resizable: false,
    // minimizable: false,
    // fullscreenable: false,
    // modal: true,
    // parent: win,
    webPreferences: {
      // preload: path.join(__dirname, 'editor.js'),
      nodeIntegration: true,
    },
  });

  // editor_window.openDevTools();

  editor_window.loadFile('./pages/editor.html');

  editor_window.on('closed', function () {
    editor_window = null;
  });
}
