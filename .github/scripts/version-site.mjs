import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export async function versionSite(directory, version) {
 if (!/^[A-Za-z0-9._-]{1,100}$/.test(version)) throw new Error('Invalid release version');
 const workerPath=path.join(directory,'sw.js'), htmlPath=path.join(directory,'index.html');
 const [worker,html]=await Promise.all([readFile(workerPath,'utf8'),readFile(htmlPath,'utf8')]);
 const workerPattern=/const APP_VERSION = '[^']+';/;
 const htmlPattern=/<meta name="app-version" content="[^"]+">/;
 if (!workerPattern.test(worker)||!htmlPattern.test(html)) throw new Error('Missing app version markers');
 await writeFile(workerPath,worker.replace(workerPattern,`const APP_VERSION = '${version}';`));
 await writeFile(htmlPath,html.replace(htmlPattern,`<meta name="app-version" content="${version}">`));
 console.log(`App version: ${version}`);
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 await versionSite(path.resolve(process.argv[2]||'.'),process.argv[3]);
}
