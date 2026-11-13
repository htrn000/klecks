import { access } from 'node:fs/promises';
import { dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
    if (specifier === '../../bb/base/base' && context.parentURL?.includes('/klecks/history/')) {
        return nextResolve(new URL('./base-stub.mjs', import.meta.url).href, context);
    }
    if (specifier.startsWith('.') && !/\.(?:[cm]?js|tsx?)$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        const base = pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);
        for (const candidate of [`${base}.ts`, `${base}.js`, `${base}.mjs`, pathResolve(base, 'index.ts')]) {
            try {
                await access(candidate);
                return nextResolve(pathToFileURL(candidate).href, context);
            } catch {}
        }
    }
    return nextResolve(specifier, context);
}
