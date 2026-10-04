import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => () => {},
  inject: () => () => {},
}));
vi.mock('@theia/core/lib/browser/widgets/widget', () => ({ Message: class {} }));
vi.mock('./control-room-react-widget', () => ({ ControlRoomReactWidget: class {} }));

import { SkillsWidget } from './skills-widget';

function widget() {
  return Object.assign(Object.create(SkillsWidget.prototype), {
    projects: [],
    selectedProjectId: undefined,
    skills: [],
    roles: [],
    catalog: [],
    catalogTruncated: false,
    catalogPreviewed: false,
    readingSkill: undefined,
    readingResource: 'SKILL.md',
    resourcePage: undefined,
    readPending: false,
    source: '',
    installName: '',
    forceInstall: false,
    catalogRole: '',
    catalogWorkType: '',
    taskText: '',
    activeSection: 'skills',
    errorMessage: undefined,
    resultMessage: undefined,
    update: vi.fn(),
  });
}

describe('Skills workspace layout', () => {
  it('provides accessible section selection and concise empty states', () => {
    const view = widget();
    const html = renderToStaticMarkup(React.createElement(view.render.bind(view)));
    expect(html).toContain('aria-label="Skills workspace sections"');
    expect(html).toContain('aria-controls="gamecrafter-skills-list"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Choose a Project for its local skills');
    expect(html).toContain('No skills are available in this scope yet');
  });

  it('collapses optional catalog criteria and exposes named fields when opened', () => {
    const view = widget();
    view.activeSection = 'catalog';
    const html = renderToStaticMarkup(React.createElement(view.render.bind(view)));
    expect(html).toContain('Catalog matching criteria');
    expect(html).toContain('aria-label="Catalog agent role"');
    expect(html).toContain('aria-label="Catalog work type"');
    expect(html).toContain('Preview eligible skills');
  });
});
