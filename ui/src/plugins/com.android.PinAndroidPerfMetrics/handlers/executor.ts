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

import type {Trace} from '../../../public/trace';
import {PinIntentKind, type MetricHandler, type PinIntent} from './metricUtils';
import {METRIC_HANDLERS} from './handlerRegistry';

/*
 * PinRequest Execution Flow:
 *
 *  +-----------------------------------------------------------------+
 *  | Clients (Startup Commands, UI Deep Links, External Consoles)    |
 *  +-----------------------------------------------------------------+
 *                                   |
 *                                   | raw args (JSON, strings, dicts)
 *                                   v
 *  +-----------------------------------------------------------------+
 *  | normalizePinIntent(arg) [pinRequest.ts]                         |
 *  |   - Delegates regex matching & dictionary parsing to handlers   |
 *  |   - Deduplicates identical requests                             |
 *  +-----------------------------------------------------------------+
 *                                   |
 *                                   | PinIntent[] (Discriminated Union)
 *                                   v
 *  +-----------------------------------------------------------------+
 *  | executePinIntents(ctx, intents) [executor.ts]                   |
 *  |   - Looks up MetricHandler via HANDLER_BY_KIND map              |
 *  |   - Executes handler.addMetricTrack(intent, ctx) directly       |
 *  +-----------------------------------------------------------------+
 */

const HANDLER_BY_KIND = new Map<PinIntentKind, MetricHandler>(
  METRIC_HANDLERS.map((h) => [h.kind, h]),
);

/**
 * Creates and executes a PinIntent to pin Android Jank CUJs.
 *
 * @param {Trace} ctx Trace context.
 * @param {string} [cujName] Specific CUJ name to pin, or '*' for all CUJs.
 */
export async function pinJankCujs(ctx: Trace, cujName: string = '*') {
  await executePinIntent(ctx, {
    kind: PinIntentKind.Cuj,
    cujName,
  });
}

/**
 * Creates and executes a PinIntent to pin Android Latency CUJs.
 *
 * @param {Trace} ctx Trace context.
 * @param {string} [cujName] Specific CUJ name to pin, or '*' for all CUJs.
 */
export async function pinLatencyCujs(ctx: Trace, cujName: string = '*') {
  await executePinIntent(ctx, {
    kind: PinIntentKind.Cuj,
    cujName,
  });
}

/**
 * Executes a single PinIntent by looking up its handler in HANDLER_BY_KIND.
 */
export async function executePinIntent(ctx: Trace, intent: PinIntent) {
  const handler = HANDLER_BY_KIND.get(intent.kind);
  if (handler !== undefined) {
    await handler.addMetricTrack(intent, ctx);
  }
}

export const executePinRequest = executePinIntent;

/**
 * Executes a list of PinIntents in order.
 */
export async function executePinIntents(ctx: Trace, intents: PinIntent[]) {
  for (const intent of intents) {
    await executePinIntent(ctx, intent);
  }
}

export const executePinRequests = executePinIntents;
