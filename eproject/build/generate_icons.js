const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  });

  const svgPath = path.join(__dirname, 'icon.svg');
  await win.loadFile(svgPath);

  // 等待渲染完成
  await new Promise(r => setTimeout(r, 600));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const pngBuffer = image.toPNG();
  const outPng = path.join(__dirname, 'icon.png');
  fs.writeFileSync(outPng, pngBuffer);
  console.log('✓ Successfully generated:', outPng, `(${pngBuffer.length} bytes)`);

  // 同时生成 256x256 图标
  const img256 = image.resize({ width: 256, height: 256 });
  const outPng256 = path.join(__dirname, 'icon-256.png');
  fs.writeFileSync(outPng256, img256.toPNG());

  app.quit();
});
