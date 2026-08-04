// Copyright (C) 2024 The Android Open Source Project
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

import type {MetricHandler} from './metricUtils';
import {pinBlockingCallHandlerInstance} from './pinBlockingCall';
import {pinNotificationsBlockingCallHandlerInstance} from './pinNotificationsBlockingCall';
import {pinCujScopedJankInstance} from './pinCujScoped';
import {pinFullTraceJankInstance} from './fullTraceJankMetricHandler';
import {pinCujInstance} from './pinCujMetricHandler';
import {pinHeapSizeMetricsInstance} from './pinHeapSizeMetricsHandler';
import {pinBitmapMetricsInstance} from './pinBitmapMetricsHandler';
import {pinDirtyMemoryMetricsInstance} from './pinDirtyMemoryMetricsHandler';
import {pinGPUMemoryMetricsInstance} from './pinGPUMemoryMetricsHandler';
import {pinActivityOrBinderLeaksMetricsInstance} from './pinActivityOrBinderLeaksMetricsHandler';
import {pinHardwareBufferMemoryMetricsInstance} from './pinHardwareBufferMemoryMetricsHandler';
import {pinGlobalDmaHeapSizeMetricsInstance} from './pinGlobalDmaHeapSizeMetricsHandler';

/**
 * HOW TO ADD A NEW METRIC HANDLER:
 * 1. Define a class implementing `MetricHandler<MyMetricData>` in its own file.
 *    - Assign a unique `readonly kind: PinIntentKind`.
 *    - Implement `match(metricKey: string)` to parse metric strings (e.g. regexes).
 *    - (Optional) Implement `parseRequest(item: Record<string, string>)` to parse dictionaries.
 *    - Implement `addMetricTrack(metricData, ctx)` to pin track(s), including any SQL query preconditions.
 * 2. Add an instance of your handler to `METRIC_HANDLERS` below.
 * That's it! String parsing, dictionary parsing, and track pinning will work automatically.
 */
export const METRIC_HANDLERS: MetricHandler[] = [
  pinCujInstance,
  pinCujScopedJankInstance,
  pinBlockingCallHandlerInstance,
  pinNotificationsBlockingCallHandlerInstance,
  pinFullTraceJankInstance,
  pinHeapSizeMetricsInstance,
  pinBitmapMetricsInstance,
  pinDirtyMemoryMetricsInstance,
  pinGPUMemoryMetricsInstance,
  pinActivityOrBinderLeaksMetricsInstance,
  pinHardwareBufferMemoryMetricsInstance,
  pinGlobalDmaHeapSizeMetricsInstance,
];
