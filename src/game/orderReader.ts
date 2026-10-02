// The order reader (src/cards/reader): a small trained model that reads free-form orders the
// rule parser can't. Its weights (models/order-reader.json, about 1 MB) are a separate file of
// the game, loaded in the background at start, so the game opens just as fast.

import type { ReaderModel } from '../cards/reader/model';
import { OrderReader } from '../cards/reader/reader';
import { readerTranslator, type Translator } from '../cards/translator';

let loading: Promise<OrderReader> | null = null;

/** Starts loading the reader; reading an order waits for it if it isn't there yet. */
export function loadOrderReader(): Promise<OrderReader> {
  loading ??= import('../../models/order-reader.json?raw')
    .then(({ default: json }) => new OrderReader(JSON.parse(json) as ReaderModel))
    .catch((error: unknown) => {
      // Try again next time, rather than never.
      loading = null;
      throw error;
    });
  return loading;
}

/** The reader as the translator after the rule parser. */
export const orderReaderTranslator: Translator = {
  name: 'reader',
  async translate(text) {
    return readerTranslator(await loadOrderReader()).translate(text);
  },
};
