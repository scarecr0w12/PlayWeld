import { injectable, inject } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { MonacoThemingService } from '@theia/monaco/lib/browser/monaco-theming-service';
import { ThemeService } from '@theia/core/lib/browser/theming';
import { PreferenceService } from '@theia/core/lib/common/preferences';

/** A real selectable IDE theme; custom widgets use the same semantic colors. */
@injectable()
export class GameCrafterThemeContribution implements FrontendApplicationContribution {
  constructor(
    @inject(MonacoThemingService) private readonly theming: MonacoThemingService,
    @inject(ThemeService) private readonly themes: ThemeService,
    @inject(PreferenceService) private readonly preferences: PreferenceService,
  ) {}
  onStart(): void {
    // Preference providers start later in the contribution loop; waiting here blocks startup.
    void this.preferences.ready.then(() => this.selectDefaultTheme());
  }
  private selectDefaultTheme(): void {
    const preference = this.preferences.inspect('workbench.colorTheme');
    if (
      preference?.globalValue === undefined &&
      preference?.workspaceValue === undefined &&
      preference?.workspaceFolderValue === undefined &&
      preference?.sessionValue === undefined
    ) {
      this.themes.setCurrentTheme('gamecrafter-neon-green', false);
    }
  }
  initialize(): void {
    this.theming.registerParsedTheme({
      id: 'gamecrafter-neon-green',
      label: 'PlayWeld Neon Green',
      description: 'Dark violet workspace with neon green accents',
      uiTheme: 'vs-dark',
      json: {
        colors: COLORS,
        tokenColors: [
          { scope: ['comment'], settings: { foreground: '#9c89ad' } },
          { scope: ['keyword', 'storage'], settings: { foreground: '#b4ff39' } },
          { scope: ['string'], settings: { foreground: '#e4c66a' } },
          {
            scope: ['entity.name.function', 'support.function'],
            settings: { foreground: '#b5e8c8' },
          },
          { scope: ['constant.numeric'], settings: { foreground: '#bcb0ff' } },
        ],
      },
    });
  }
}
const COLORS = {
  foreground: '#eee8f7',
  descriptionForeground: '#b7abc7',
  focusBorder: '#b4ff39',
  errorForeground: '#ff8181',
  'widget.border': '#3b2f4c',
  'textLink.foreground': '#b4ff39',
  'textLink.activeForeground': '#d0ff86',
  'selection.background': '#b4ff3933',
  'editor.background': '#110d1c',
  'editor.foreground': '#eee8f7',
  'editor.lineHighlightBackground': '#19221b',
  'editor.selectionBackground': '#b4ff3929',
  'editorCursor.foreground': '#b4ff39',
  'editorLineNumber.foreground': '#857294',
  'editorLineNumber.activeForeground': '#b4ff39',
  'editorWidget.background': '#1c1528',
  'editorWidget.foreground': '#eee8f7',
  'editorWidget.border': '#4a3a5e',
  'editorGroupHeader.tabsBackground': '#110d1c',
  'tab.activeBackground': '#1c1528',
  'tab.activeForeground': '#eee8f7',
  'tab.inactiveBackground': '#110d1c',
  'tab.inactiveForeground': '#b7abc7',
  'tab.activeBorderTop': '#b4ff39',
  'sideBar.background': '#161020',
  'sideBar.foreground': '#d0c5df',
  'sideBarTitle.foreground': '#eee8f7',
  'sideBarSectionHeader.background': '#21192f',
  'sideBar.border': '#362a47',
  'activityBar.background': '#100c19',
  'activityBar.foreground': '#b4ff39',
  'activityBar.inactiveForeground': '#a99ab9',
  'activityBar.activeBorder': '#b4ff39',
  'activityBar.border': '#362a47',
  'statusBar.background': '#100c19',
  'statusBar.foreground': '#c1b3d1',
  'statusBar.noFolderBackground': '#100c19',
  'statusBar.noFolderForeground': '#c1b3d1',
  'statusBar.border': '#362a47',
  'button.background': '#b4ff39',
  'button.foreground': '#121c0b',
  'button.hoverBackground': '#c8ff70',
  'button.secondaryBackground': '#2a2038',
  'button.secondaryForeground': '#eee8f7',
  'button.secondaryHoverBackground': '#3a2c4d',
  'secondaryButton.background': '#2a2038',
  'secondaryButton.foreground': '#eee8f7',
  'secondaryButton.hoverBackground': '#3a2c4d',
  'input.background': '#110d1c',
  'input.foreground': '#eee8f7',
  'input.border': '#4a3a5e',
  'input.placeholderForeground': '#a99ab9',
  'dropdown.background': '#1c1528',
  'dropdown.foreground': '#eee8f7',
  'dropdown.border': '#4a3a5e',
  'list.hoverBackground': '#2a2038',
  'list.activeSelectionBackground': '#33472a',
  'list.activeSelectionForeground': '#eee8f7',
  'list.inactiveSelectionBackground': '#2d223c',
  'list.focusOutline': '#b4ff39',
  'menu.background': '#1c1528',
  'menu.foreground': '#eee8f7',
  'menu.border': '#4a3a5e',
  'menu.separatorBackground': '#4a3a5e',
  'menu.selectionBackground': '#33472a',
  'menu.selectionForeground': '#eee8f7',
  'menubar.selectionBackground': '#30243f',
  'panel.background': '#110d1c',
  'panel.border': '#362a47',
  'panelTitle.activeForeground': '#b4ff39',
  'panelTitle.inactiveForeground': '#b7abc7',
  'titleBar.activeBackground': '#100c19',
  'titleBar.activeForeground': '#eee8f7',
  'titleBar.inactiveBackground': '#100c19',
  'titleBar.inactiveForeground': '#b7abc7',
  'notificationCenterHeader.background': '#2a2038',
  'notifications.background': '#1c1528',
  'notifications.foreground': '#eee8f7',
  'notifications.border': '#4a3a5e',
  'notificationCenter.border': '#4a3a5e',
  'notificationToast.border': '#4a3a5e',
  'quickInput.background': '#1c1528',
  'quickInput.foreground': '#eee8f7',
  'quickInputTitle.background': '#2a2038',
  'quickInputList.focusBackground': '#33472a',
  'quickInputList.focusForeground': '#eee8f7',
  'settings.headerForeground': '#eee8f7',
  'settings.modifiedItemIndicator': '#b4ff39',
  'settings.dropdownBackground': '#1c1528',
  'settings.dropdownForeground': '#eee8f7',
  'settings.dropdownBorder': '#4a3a5e',
  'settings.textInputBackground': '#110d1c',
  'settings.textInputForeground': '#eee8f7',
  'settings.textInputBorder': '#4a3a5e',
  'progressBar.background': '#b4ff39',
  'badge.background': '#b4ff39',
  'badge.foreground': '#121c0b',
  'terminal.background': '#110d1c',
  'terminal.foreground': '#eee8f7',
  'terminal.ansiGreen': '#b4ff39',
  'terminal.ansiYellow': '#e4c66a',
  'editorWarning.foreground': '#e4c66a',
};
