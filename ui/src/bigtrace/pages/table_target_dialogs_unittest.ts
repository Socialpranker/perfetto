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

import {describe, expect, test} from 'vitest';
import {needsTablePrompt, type TableTargetState} from './table_target_dialogs';

function tab(over: Partial<TableTargetState> = {}): TableTargetState {
  return {materialize: true, reuseTable: false, ...over};
}

describe('when a run has to ask about its table', () => {
  test('an ephemeral run has no table to ask about', () => {
    expect(needsTablePrompt(tab({materialize: false}))).toBe('none');
    expect(needsTablePrompt(tab({materialize: false, reuseTable: true}))).toBe(
      'none',
    );
  });

  test('a tab without an answer of its own asks for one', () => {
    expect(needsTablePrompt(tab())).toBe('name');
    expect(needsTablePrompt(tab({tableName: 'jank'}))).toBe('name');
  });

  test('a tab told to keep its answer stops asking', () => {
    expect(needsTablePrompt(tab({tableName: 'jank', reuseTable: true}))).toBe(
      'none',
    );
  });

  test('keeping an empty answer means keeping automatic naming', () => {
    // No name and reuse: the user said "stop asking, let the backend name
    // them" — which is an answer, not a missing one.
    expect(needsTablePrompt(tab({reuseTable: true}))).toBe('none');
  });
});
