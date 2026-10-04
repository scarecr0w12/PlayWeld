import { injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { PLAYWELD_FAVICON } from './brand-geometry';

@injectable()
export class PlayWeldBrandContribution implements FrontendApplicationContribution {
  onStart(): void {
    document.body.classList.add('playweld-workbench');
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.type = 'image/svg+xml';
    icon.href = PLAYWELD_FAVICON;
  }
}
