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
import {Checkbox} from '../../widgets/checkbox';
import {closeModal, redrawModal, showModal} from '../../widgets/modal';
import {TextInput} from '../../widgets/text_input';
import {
  BigtraceQueryClient,
  QueryCancelledError,
  type TableNameCheck,
} from '../query/bigtrace_query_client';
import {getBigtraceEndpoint} from '../settings/endpoint_storage';
import {defaultModePref} from '../settings/run_prefs';
import {applyModeDefaults, type BigTraceEditorTab} from './query_tabs_state';

// Long enough not to ask on every keystroke, short enough that the answer is
// there by the time the user stops typing.
const CHECK_DEBOUNCE_MS = 400;

// What a run has to ask before it can go ahead.
export type TablePromptDecision = 'none' | 'name';

// Just enough of a tab to decide, so the rule is testable without one.
export interface TableTargetState {
  readonly materialize: boolean;
  readonly tableName?: string;
  readonly reuseTable: boolean;
}

// Only a persistent run writes a table, so only a persistent run is asked
// about one. Past that the tab's own answer stands: `reuseTable` is the user
// saying this query writes here from now on, and it holds whether they named
// the table or left it to the backend.
export function needsTablePrompt(tab: TableTargetState): TablePromptDecision {
  if (!tab.materialize) return 'none';
  return tab.reuseTable ? 'none' : 'name';
}

// Everything a run must settle before it starts. Returns false only when the
// user backs out, and is called before the run has touched the tab, so
// backing out leaves nothing to undo.
export async function ensureTableTarget(
  tab: BigTraceEditorTab,
): Promise<boolean> {
  // No backend to run against; the run's own endpoint error says so.
  if (getBigtraceEndpoint() === '') return true;

  // What kind of query this is comes before anything about tables: an
  // ephemeral run writes none.
  if (defaultModePref.get() === 'unset') {
    await askDefaultMode(tab);
  }

  if (needsTablePrompt(tab) === 'none') return true;
  return promptTableTarget(tab);
}

// Asked once, at the very first run. Both answers are real answers, so there
// is no "later": a default has to be something, and the one already in force
// is what closing the dialog keeps.
export async function askDefaultMode(tab: BigTraceEditorTab): Promise<void> {
  let chosen: boolean | undefined;
  await showModal({
    title: 'How should your queries run?',
    content: () =>
      m(
        '.pf-bt-table-prompt',
        m(
          'div',
          'Ephemeral queries show their results here and are discarded ' +
            'when the tab closes. Persistent queries write their results ' +
            'to a table you can reopen from History later. You can switch ' +
            'any query with the toggle beside Run.',
        ),
      ),
    buttons: [
      {
        text: 'Ephemeral',
        action: () => {
          chosen = false;
        },
      },
      {
        text: 'Persistent',
        primary: true,
        action: () => {
          chosen = true;
        },
      },
    ],
  });
  if (chosen === undefined) return;
  defaultModePref.set(chosen ? 'persistent' : 'ephemeral');
  // The answer is about this run too, not just the next new tab.
  applyModeDefaults(tab, chosen);
}

// The naming prompt. Resolves false when the user cancels, which cancels the
// run with it.
export async function promptTableTarget(
  tab: BigTraceEditorTab,
): Promise<boolean> {
  let name = tab.tableName ?? '';
  // Permission to clobber, asked per run: it says nothing about whether this
  // tab keeps being asked.
  let overwrite = false;
  let stopAskingHere = tab.reuseTable;
  let confirmed = false;

  // The last answer about the name as typed, plus the request behind it.
  let check: TableNameCheck | undefined;
  let checking = false;
  // A check that couldn't be made is not an answer, but it must not hold the
  // run hostage either.
  let checkFailed = false;
  let sequence = 0;
  let inFlight: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const abort = () => {
    inFlight?.abort();
    inFlight = undefined;
  };

  const runCheck = async (wanted: string) => {
    const mySequence = ++sequence;
    abort();
    const controller = new AbortController();
    inFlight = controller;
    checking = true;
    checkFailed = false;
    try {
      const client = new BigtraceQueryClient(getBigtraceEndpoint());
      const result = await client.checkTableExists(wanted, controller.signal);
      if (mySequence !== sequence) return;
      check = result;
    } catch (e) {
      if (mySequence !== sequence) return;
      if (e instanceof QueryCancelledError) return;
      // A check that fails tells us nothing, so it blocks nothing.
      check = undefined;
      checkFailed = true;
    } finally {
      if (mySequence === sequence) {
        checking = false;
        if (inFlight === controller) inFlight = undefined;
        redrawModal();
      }
    }
  };

  const onNameInput = (value: string) => {
    name = value;
    check = undefined;
    checkFailed = false;
    // Permission was given for the table that was named a moment ago, not
    // for whatever is named now.
    overwrite = false;
    clearTimeout(timer);
    const wanted = value.trim();
    if (wanted === '') {
      // Empty is a real answer — the backend names it — so there is nothing
      // to look up.
      sequence++;
      abort();
      checking = false;
      return;
    }
    checking = true;
    timer = setTimeout(() => void runCheck(wanted), CHECK_DEBOUNCE_MS);
  };

  // A prompt that opens with a name in it opens with a name that exists —
  // this tab wrote it last run. Ask before the user can press Run, or the
  // block would never come up and the table would go silently.
  if (name.trim() !== '') {
    checking = true;
    void runCheck(name.trim());
  }

  // A named run waits for the backend's answer about that name, then for the
  // user's if the answer was "taken". Running while the answer is still
  // coming would step straight past the guard — the checkbox that permits an
  // overwrite only exists once there is something to overwrite.
  const blocked = () => {
    if (name.trim() === '') return false;
    if (checking) return true;
    if (check === undefined) return !checkFailed;
    return check.exists && !overwrite;
  };

  // Named so the field can close it: typing a name and pressing Enter is the
  // obvious way to answer a one-field dialog, and the modal's own Enter goes
  // to the primary button, which the field's focus takes away.
  const modalKey = 'pf-bt-table-target';
  await showModal({
    key: modalKey,
    title: "Name this query's table",
    className: 'pf-bt-table-prompt-modal',
    content: () =>
      m('.pf-bt-table-prompt', [
        m('label', 'Table name'),
        m(TextInput, {
          value: name,
          autofocus: true,
          placeholder: 'Leave empty for an automatic name',
          onInput: onNameInput,
          onkeydown: (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;
            // Nothing to do if the run is blocked; the warning already says
            // what is missing.
            if (blocked()) return;
            confirmed = true;
            closeModal(modalKey);
          },
        }),
        renderCheckState(name, checking, check),
        // Only when there is a table to overwrite: otherwise this is a
        // control for a situation that isn't happening, and the run is not
        // waiting on it. Sits with the warning it answers.
        check?.exists === true &&
          renderCheckbox('Overwrite it', overwrite, (checked) => {
            overwrite = checked;
          }),
        m(
          '.pf-bt-table-prompt__ttl',
          `Kept for ${tab.tableTtlDays} days. Advanced Query Settings ` +
            'changes that.',
        ),
        // A choice about this query, not about future dialogs: what it
        // settles is where later runs write, and not being asked follows
        // from that.
        renderCheckbox(
          'Use this for later runs of this query',
          stopAskingHere,
          (checked) => {
            stopAskingHere = checked;
          },
        ),
      ]),
    buttons: [
      {text: 'Cancel'},
      {
        text: 'Run',
        primary: true,
        disabled: () => blocked(),
        action: () => {
          confirmed = true;
        },
      },
    ],
  });

  clearTimeout(timer);
  sequence++;
  abort();
  if (!confirmed) return false;

  const chosen = name.trim();
  tab.tableName = chosen === '' ? undefined : chosen;
  tab.reuseTable = stopAskingHere;
  return true;
}

// What the backend says about the name as it stands: nothing at all for an
// empty one, since that asks the backend to choose.
function renderCheckState(
  name: string,
  checking: boolean,
  check: TableNameCheck | undefined,
): m.Children {
  if (name.trim() === '') return null;
  if (checking) {
    return m('.pf-bt-table-prompt__hint', 'Checking…');
  }
  if (check === undefined) return null;
  if (check.exists) {
    return m(
      '.pf-bt-table-prompt__hint.pf-bt-table-prompt__hint--warn',
      `A table called ${check.resolvedTableName} already exists.`,
    );
  }
  return m(
    '.pf-bt-table-prompt__hint',
    `Will create ${check.resolvedTableName}.`,
  );
}

// Checkbox puts its handler on the wrapping label, so the checked state comes
// from the input inside it rather than the event target.
function renderCheckbox(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): m.Children {
  return m(Checkbox, {
    label,
    checked,
    onchange: (e: Event) => {
      const target = e.currentTarget;
      if (!(target instanceof HTMLLabelElement)) return;
      const input = target.querySelector('input');
      if (input) onChange(input.checked);
      redrawModal();
    },
  });
}
