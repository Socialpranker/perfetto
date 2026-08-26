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

import {beforeEach, describe, expect, test} from 'vitest';
import {defaultModePref} from './run_prefs';

describe('how new queries run', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('nobody has been asked yet', () => {
    expect(defaultModePref.get()).toBe('unset');
  });

  test('each answer is remembered', () => {
    defaultModePref.set('ephemeral');
    expect(defaultModePref.get()).toBe('ephemeral');
    defaultModePref.set('persistent');
    expect(defaultModePref.get()).toBe('persistent');
  });

  test('an unreadable store means nobody has answered', () => {
    localStorage.setItem('bigtraceDefaultMode', '{"pref": "sideways"}');
    expect(defaultModePref.get()).toBe('unset');
  });
});
