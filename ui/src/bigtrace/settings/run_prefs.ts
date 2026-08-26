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

import {SingleFieldStorage} from './single_field_storage';

// How the user prefers their queries to run. 'unset' = never been asked,
// which the first run resolves. This one gates what follows: someone who runs
// ephemeral queries never creates a table, so is never asked about one.
export type DefaultModePref = 'unset' | 'ephemeral' | 'persistent';

export const defaultModePref = new SingleFieldStorage<DefaultModePref>(
  'bigtraceDefaultMode',
  'pref',
  (raw) => (raw === 'ephemeral' || raw === 'persistent' ? raw : 'unset'),
  'unset',
);
