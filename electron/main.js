// PC sürümü: www/index.html'i "app://" üzerinden açar (ES modülleri ve WebAssembly için gerekli).
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 920, backgroundColor: '#0e1014', title: 'MEB Robot Simülatörü', autoHideMenuBar: true });
  win.loadURL('app://local/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (!p || p === '/') p = '/index.html';
    return net.fetch(pathToFileURL(path.join(__dirname, '..', 'www', p)).toString());
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
