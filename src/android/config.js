const path = require('path');
const xml = require('xmldoc');
const fs = require('fs');
const efs = require('../utils/fs');
const glob = require('glob');

// Default android source directory to look for files
const BASE_DIR = './android';
const GLOB_PATTERN = '**/*.java';

/**
 * Gets source directory for current folder
 *
 * Given folder, it checks if /android exists, if no - returns null
 * Tries to find /app folder in /android and if it exists - returns it
 * Otherwise returns /android
 */
const getSourceDirectory = (folder) => {
  if (!fs.existsSync(path.join(folder, BASE_DIR))) {
    return null;
  }

  if (fs.existsSync(path.join(folder, BASE_DIR, 'app'))) {
    return path.join(BASE_DIR, 'app');
  }

  return BASE_DIR;
};

/**
 * Gets package name by opening AndroidManifest.xml and reading
 * package attribute
 */
const getPackageName = (src) => {
  const manifest = new xml.XmlDocument(
    efs.loadFile(path.join(src, 'src/main/AndroidManifest.xml'))
  );

  return manifest.attr.package;
};

/**
 * Given package name, replaces . to separators to follow Java convention
 * and locate .java files
 */
const getPackageFolder = (packageName) => packageName.replace('.', path.sep);

/**
 * Gets package name (class that implements ReactPackage) by searching for its
 * declaration in all Java files present in the src
 */
const getPackageInstance = (src) => {
  const files = glob.sync(GLOB_PATTERN, {
    cwd: src,
  });

  const packages = files
    .map(filePath => efs.loadFile(path.join(src, filePath)))
    .map(file => file.match(/class (.*) implements ReactPackage/))
    .filter(match => match);

  // No packages exported, ignore
  if (packages.length === 0) {
    return null;
  }

  return packages[0][1];
};

/**
 * Gets android project config by analyzing given folder and taking some
 * defaults specified by user into consideration
 */
exports.projectConfig = function projectConfigAndroid(folder, userConfig) {
  const sourceDir = userConfig.sourceDir || getSourceDirectory(folder);

  if (!sourceDir) {
    return null;
  }

  const src = path.join(folder, sourceDir);
  const packageName = userConfig.packageName || getPackageName(src);
  const packageFolder = userConfig.packageFolder || getPackageFolder(packageName);

  return {
    src: src,
    folder: folder,
    project: path.join(src, userConfig.project || 'build.gradle'),
    settings: path.join(folder, BASE_DIR, userConfig.settings || 'settings.gradle'),
    assetsPath: path.join(src, userConfig.assetsPath || 'src/main/assets'),
    mainActivity: path.join(src, userConfig.mainActivity || `src/main/java/${packageFolder}/MainActivity.java`),
  };
};

/**
 * Same as projectConfigAndroid except it returns different config that applies to packages
 * only
 */
exports.dependencyConfig = function dependencyConfigAndroid(folder, userConfig) {
  const sourceDir = userConfig.sourceDir || getSourceDirectory(folder);

  if (!sourceDir) {
    return null;
  }

  const src = path.join(folder, sourceDir);
  const packageName = userConfig.packageName || getPackageName(src);
  const packageInstance = userConfig.packageInstance || getPackageInstance(src);

  // This module has no package to export
  if (!packageInstance) {
    return null;
  }

  return {
    src: src,
    folder: folder,
    packageImportPath: `import ${packageName}.${packageInstance}`,
    packageInstance: `new ${packageInstance}()`,
  };
};
