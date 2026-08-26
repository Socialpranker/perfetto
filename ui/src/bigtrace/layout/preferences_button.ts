// Copyright (C) 2026 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import m from 'mithril';
import {Button} from '../../widgets/button';
import {Popup, PopupPosition} from '../../widgets/popup';
import {defaultModePref} from '../settings/run_prefs';
import {renderSegmented} from '../widgets/segmented';

// One topbar, one panel, so its open state lives here rather than in the
// instance — that way a command can open it too.
let panelOpen = false;

export function openPreferences(): void {
  panelOpen = true;
  m.redraw();
}

// Preferences that belong to the app rather than to any one query.
export class PreferencesButton implements m.ClassComponent {
  view() {
    return m(
      Popup,
      {
        trigger: m(Button, {
          icon: 'tune',
          title: 'Preferences',
          onclick: () => {
            panelOpen = !panelOpen;
          },
        }),
        isOpen: panelOpen,
        onChange: (isOpen: boolean) => {
          panelOpen = isOpen;
        },
        position: PopupPosition.BottomEnd,
        // Each row is a label beside its control; the default popup width
        // would cut the controls off.
        fitContent: true,
        className: 'pf-bt-preferences-popup',
      },
      this.renderPanel(),
    );
  }

  private renderPanel(): m.Children {
    const mode = defaultModePref.get();
    return m('.pf-bt-preferences-panel', [
      m('.pf-bt-preferences-panel__title', 'Preferences'),
      m('.pf-bt-preferences-panel__section', 'New queries'),
      m('.pf-bt-preferences-panel__row', [
        m('.pf-bt-preferences-panel__label', [
          'Run as',
          mode === 'unset' &&
            m(
              '.pf-bt-preferences-panel__detail',
              'Not chosen yet — the first run asks',
            ),
        ]),
        renderSegmented(
          [
            {key: 'ephemeral', label: 'Ephemeral'},
            {key: 'persistent', label: 'Persistent'},
          ],
          // Unset shows the standing default rather than an empty control.
          mode === 'ephemeral' ? 'ephemeral' : 'persistent',
          (key) => {
            defaultModePref.set(
              key === 'ephemeral' ? 'ephemeral' : 'persistent',
            );
            m.redraw();
          },
        ),
      ]),
    ]);
  }
}
