/**
 * Build and version metadata.
 * APP_VERSION is automatically populated from package.json in Vite build/dev.
 * Git commit and branch are automatically detected if Git is initialized.
 */
declare const __APP_VERSION__: string;
declare const __BUILD_TS__: string;
declare const __GIT_COMMIT__: string;
declare const __GIT_BRANCH__: string;
declare const __HAS_GIT__: boolean;

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.5.0';
export const BUILD_TS: string = typeof __BUILD_TS__ !== 'undefined' ? __BUILD_TS__ : '';
export const GIT_COMMIT: string = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : '';
export const GIT_BRANCH: string = typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : '';
export const HAS_GIT: boolean = typeof __HAS_GIT__ !== 'undefined' ? __HAS_GIT__ : false;

/** Versão canônica e atual do Google Apps Script Webhook de sincronização do Dimensio */
export const APPS_SCRIPT_VERSION = '4.6.0';
export const WEBHOOK_SCRIPT_VERSION = '4.6.0';

export const GIT_INFO = GIT_COMMIT
  ? `${GIT_BRANCH ? `${GIT_BRANCH}@` : ''}${GIT_COMMIT}`
  : HAS_GIT
  ? 'git-ativo'
  : 'sem-git';

export const FULL_VERSION = `Dimensio v${APP_VERSION}${GIT_COMMIT ? ` (${GIT_COMMIT})` : ''}${
  BUILD_TS ? ` • ${BUILD_TS}` : ''
}`;

