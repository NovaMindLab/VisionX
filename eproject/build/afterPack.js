const fs = require('fs');
const path = require('path');

/**
 * electron-builder afterPack 钩子
 * 在打包成安装包/便携版之前，裁剪冗余的多国语言包，仅保留中文与英文
 */
exports.default = async function (context) {
  const localesDir = path.join(context.appOutDir, 'locales');
  if (!fs.existsSync(localesDir)) {
    return;
  }

  // 仅保留简体中文、繁体中文、英文(US/GB)
  const allowedLocales = new Set([
    'zh-CN.pak',
    'zh-TW.pak',
    'en-US.pak',
    'en-GB.pak',
  ]);

  const files = fs.readdirSync(localesDir);
  let removedCount = 0;

  for (const file of files) {
    if (file.endsWith('.pak') && !allowedLocales.has(file)) {
      try {
        fs.unlinkSync(path.join(localesDir, file));
        removedCount++;
      } catch (err) {
        console.warn(`[afterPack] 无法删除语言包: ${file}`, err);
      }
    }
  }

  console.log(`[afterPack] ✓ 成功精简多语言包: 移除了 ${removedCount} 个无用小语种，保留中英文包。`);
};
