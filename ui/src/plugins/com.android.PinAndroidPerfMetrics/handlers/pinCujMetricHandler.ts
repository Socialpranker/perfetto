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

import {
  ALL_JANK_CUJS_FLAG_ALIASES,
  ALL_LATENCY_CUJS_FLAG_ALIASES,
  CUJ_FIELD_ALIASES,
  extractBooleanFlag,
  extractCujName,
  isValidDictionaryRequest,
  PinIntentKind,
  type CujMetricData,
  type MetricHandler,
} from './metricUtils';
import type {Trace} from '../../../public/trace';
import {
  pinJankCujs as pinAllJankCujsFromPlugin,
  pinLatencyCujs as pinAllLatencyCujsFromPlugin,
} from '../../com.android.AndroidCujs';

/** Pins a single CUJ or all CUJs from CUJ scoped metrics. */
class PinCujMetricHandler implements MetricHandler<CujMetricData> {
  public readonly kind = PinIntentKind.Cuj;

  public match(metricKey: string): CujMetricData | undefined {
    const matcher =
      /perfetto_cuj_(?<process>.*)-(?<cujName>.*)-.*-(?:weighted_)?missed_.*/;
    const match = matcher.exec(metricKey);
    if (!match?.groups) {
      return undefined;
    }
    return {
      cujName: match.groups.cujName,
    };
  }

  public parseRequest(item: Record<string, string>): CujMetricData | undefined {
    if (
      !isValidDictionaryRequest(item, this.kind, [
        ...CUJ_FIELD_ALIASES,
        ...ALL_JANK_CUJS_FLAG_ALIASES,
        ...ALL_LATENCY_CUJS_FLAG_ALIASES,
      ])
    ) {
      return undefined;
    }
    if (
      extractBooleanFlag(item, ALL_JANK_CUJS_FLAG_ALIASES) ||
      extractBooleanFlag(item, ALL_LATENCY_CUJS_FLAG_ALIASES)
    ) {
      return {cujName: '*'};
    }
    const cujName = extractCujName(item);
    if (cujName !== undefined) {
      return {cujName};
    }
    return undefined;
  }

  public async addMetricTrack(metricData: CujMetricData, ctx: Trace) {
    await pinAllJankCujsFromPlugin(ctx, metricData.cujName);
    await pinAllLatencyCujsFromPlugin(ctx, metricData.cujName);
  }
}

export const pinCujInstance = new PinCujMetricHandler();
